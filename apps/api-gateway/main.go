package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/analytics"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/config"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/server"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

const (
	readHeaderTimeout = 5 * time.Second
	readTimeout       = 15 * time.Second
	writeTimeout      = 15 * time.Second
	idleTimeout       = 60 * time.Second
	shutdownTimeout   = 10 * time.Second
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	var publishers store.PublisherStore
	var receipts store.ReceiptStore
	storage := "memory"

	if cfg.DatabaseURL != "" {
		pg, err := store.NewPostgres(cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("postgres: %v", err)
		}
		defer pg.Close()
		publishers = pg.Publishers()
		receipts = pg.Receipts()
		storage = "postgres"
	} else {
		publishers = store.NewMemoryPublisherStore()
		receipts = store.NewMemoryReceiptStore()
		log.Println("DATABASE_URL not set, using in-memory store. Demo only.")
	}

	gin.SetMode(gin.ReleaseMode)
	router := server.New(server.Deps{
		Publishers: publishers,
		Receipts:   receipts,
		Analytics:  analytics.New(receipts),
		Network:    cfg.Network,
		Storage:    storage,
	})

	if err := router.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Fatalf("trusted proxies: %v", err)
	}

	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("octroi-api-gateway listening on %s (network=%s storage=%s)", addr, cfg.Network, storage)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutdown signal received, draining connections")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
}
