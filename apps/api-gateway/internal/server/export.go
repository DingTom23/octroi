package server

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/auth"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

const exportPageSize = 100

var exportColumns = []string{
	"nonce",
	"timestamp",
	"resource",
	"from",
	"to",
	"amount",
	"asset",
	"settlement",
	"onchainTxHash",
	"facilitatorPubkey",
	"signature",
}

// exportPublisherReceipts streams a publisher's receipts as CSV or NDJSON.
// The publisher must present its own API key; the path is publisher-scoped so
// it cannot collide with GET /receipts/:nonce.
func (s *server) exportPublisherReceipts(c *gin.Context) {
	authed, err := auth.Authenticate(c.GetHeader("Authorization"), s.d.Publishers)
	if err != nil {
		serverError(c, err)
		return
	}
	if authed == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_api_key"})
		return
	}

	p, err := s.d.Publishers.Get(c.Param("id"))
	if err != nil {
		serverError(c, err)
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "publisher not found"})
		return
	}
	if p.ID != authed.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not_owner"})
		return
	}

	format := strings.ToLower(c.DefaultQuery("format", "csv"))
	if format != "csv" && format != "json" {
		badRequest(c, "format must be csv or json")
		return
	}

	from, ok := normalizeBound(c.Query("from"))
	if !ok {
		badRequest(c, "invalid from (expected ISO 8601)")
		return
	}
	to, ok := normalizeBound(c.Query("to"))
	if !ok {
		badRequest(c, "invalid to (expected ISO 8601)")
		return
	}
	if from != "" && to != "" && from > to {
		badRequest(c, "from must not be after to")
		return
	}

	filter := store.ReceiptFilter{
		PublisherID:   p.ID,
		FromTimestamp: from,
		ToTimestamp:   to,
		Limit:         exportPageSize,
	}
	filename := fmt.Sprintf(
		"octroi-receipts-%s-%s.%s",
		p.ID,
		time.Now().UTC().Format("2006-01-02"),
		format,
	)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Header("Cache-Control", "no-store")

	if format == "csv" {
		c.Header("Content-Type", "text/csv; charset=utf-8")
		writeExportCSV(c, s, filter)
		return
	}
	c.Header("Content-Type", "application/x-ndjson; charset=utf-8")
	writeExportJSON(c, s, filter)
}

func writeExportCSV(c *gin.Context, s *server, filter store.ReceiptFilter) {
	w := csv.NewWriter(c.Writer)
	if err := w.Write(exportColumns); err != nil {
		log.Printf("receipt export csv header: %v", err)
		return
	}
	for {
		page, err := s.d.Receipts.List(filter)
		if err != nil {
			log.Printf("receipt export csv page: %v", err)
			return
		}
		for _, r := range page {
			if err := w.Write(receiptCSVRow(r)); err != nil {
				log.Printf("receipt export csv row: %v", err)
				return
			}
		}
		w.Flush()
		if len(page) < exportPageSize {
			return
		}
		filter.Offset += len(page)
	}
}

func writeExportJSON(c *gin.Context, s *server, filter store.ReceiptFilter) {
	enc := json.NewEncoder(c.Writer)
	for {
		page, err := s.d.Receipts.List(filter)
		if err != nil {
			log.Printf("receipt export json page: %v", err)
			return
		}
		for _, r := range page {
			if err := enc.Encode(r); err != nil {
				log.Printf("receipt export json row: %v", err)
				return
			}
		}
		if len(page) < exportPageSize {
			return
		}
		filter.Offset += len(page)
	}
}

func receiptCSVRow(r store.Receipt) []string {
	onchain := ""
	if r.OnchainTxHash != nil {
		onchain = *r.OnchainTxHash
	}
	return []string{
		r.Nonce,
		r.Timestamp,
		r.Resource,
		r.From,
		r.To,
		r.Amount,
		r.Asset,
		r.Settlement,
		onchain,
		r.FacilitatorPubkey,
		r.Signature,
	}
}

// normalizeBound canonicalises an ISO 8601 bound to UTC RFC3339. Empty input
// means "unbounded". Sub-second precision is dropped; receipt timestamps are
// stored at second precision.
func normalizeBound(raw string) (string, bool) {
	if strings.TrimSpace(raw) == "" {
		return "", true
	}
	t, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		t, err = time.Parse(time.RFC3339, raw)
	}
	if err != nil {
		return "", false
	}
	return t.UTC().Format(time.RFC3339), true
}
