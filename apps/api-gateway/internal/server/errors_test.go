package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestServerErrorHidesInternalDetail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	serverError(c, errors.New(`pq: relation "receipts" does not exist`))

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500", w.Code)
	}
	if strings.Contains(w.Body.String(), "pq:") || strings.Contains(w.Body.String(), "receipts") {
		t.Fatalf("internal error leaked to the client: %s", w.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["error"] != "internal_error" {
		t.Fatalf("error field %v", body["error"])
	}
	if _, ok := body["message"]; ok {
		t.Fatalf("response must not carry a message field: %v", body)
	}
}
