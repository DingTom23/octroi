package server

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

const (
	usdcAsset   = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
	facilitator = "GAGKSIFYESGEZUJZH4PJB333B3QGGNOT43LFV2ANAK4NWIVJJDM33J7P"
)

func createPublisherForTest(t *testing.T, h http.Handler, domain string) (id, key string) {
	t.Helper()
	w, body := do(t, h, http.MethodPost, "/publishers", `{"domain":"`+domain+`","walletAddress":"`+gAddr+`"}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("create publisher: status %d body %s", w.Code, w.Body.String())
	}
	pub, ok := body["publisher"].(map[string]any)
	if !ok {
		t.Fatalf("publisher missing from %v", body)
	}
	return pub["id"].(string), body["apiKey"].(string)
}

func seedReceipt(mr *store.MemoryReceiptStore, nonce, publisherID, timestamp, resource string) {
	mr.Add(store.Receipt{
		Version:           "1",
		PublisherID:       publisherID,
		Resource:          resource,
		Amount:            "1000",
		Asset:             usdcAsset,
		Network:           "stellar-testnet",
		From:              gAddr,
		To:                gAddr,
		Nonce:             nonce,
		Timestamp:         timestamp,
		Settlement:        "x402",
		FacilitatorPubkey: facilitator,
		Signature:         "c2ln",
	})
}

func exportRequest(h http.Handler, path, key string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

func TestExportRequiresAuth(t *testing.T) {
	h, _ := testServer()
	id, _ := createPublisherForTest(t, h, "auth.example")

	w := exportRequest(h, "/publishers/"+id+"/receipts/export", "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status %d, want 401", w.Code)
	}
}

func TestExportRejectsForeignPublisher(t *testing.T) {
	h, _ := testServer()
	_, keyA := createPublisherForTest(t, h, "owner.example")
	idB, _ := createPublisherForTest(t, h, "other.example")

	w := exportRequest(h, "/publishers/"+idB+"/receipts/export", keyA)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status %d, want 403", w.Code)
	}
}

func TestExportCSVEscapesAndFilters(t *testing.T) {
	h, mr := testServer()
	id, key := createPublisherForTest(t, h, "csv.example")
	seedReceipt(mr, "r1", id, "2026-06-15T12:00:00Z", "https://example.com/before")
	tricky := `https://example.com/a,b"c`
	seedReceipt(mr, "r2", id, "2026-06-16T12:00:00Z", tricky)
	seedReceipt(mr, "r3", id, "2026-06-17T12:00:00Z", "https://example.com/after")

	w := exportRequest(
		h,
		"/publishers/"+id+"/receipts/export?format=csv&from=2026-06-16T00:00:00Z&to=2026-06-16T23:59:59Z",
		key,
	)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body %s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/csv") {
		t.Fatalf("content-type %q", ct)
	}
	if cd := w.Header().Get("Content-Disposition"); !strings.Contains(cd, "attachment") || !strings.Contains(cd, ".csv") {
		t.Fatalf("content-disposition %q", cd)
	}
	if !strings.Contains(w.Body.String(), `"https://example.com/a,b""c"`) {
		t.Fatalf("CSV escaping missing: %s", w.Body.String())
	}

	rows, err := csv.NewReader(strings.NewReader(w.Body.String())).ReadAll()
	if err != nil {
		t.Fatalf("parse csv: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("rows %d, want header + one filtered receipt: %v", len(rows), rows)
	}
	if strings.Join(rows[0], ",") != strings.Join(exportColumns, ",") {
		t.Fatalf("header %v", rows[0])
	}
	if rows[1][0] != "r2" || rows[1][2] != tricky {
		t.Fatalf("row %v", rows[1])
	}
}

func TestExportJSONIsNewlineDelimitedAndPaginates(t *testing.T) {
	h, mr := testServer()
	id, key := createPublisherForTest(t, h, "json.example")
	const total = exportPageSize + 7
	for i := 0; i < total; i++ {
		seedReceipt(
			mr,
			fmt.Sprintf("n%03d", i),
			id,
			fmt.Sprintf("2026-06-%02dT12:00:00Z", 1+i%28),
			fmt.Sprintf("https://example.com/%d", i),
		)
	}

	w := exportRequest(h, "/publishers/"+id+"/receipts/export?format=json", key)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d body %s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/x-ndjson") {
		t.Fatalf("content-type %q", ct)
	}
	lines := strings.Split(strings.TrimSpace(w.Body.String()), "\n")
	if len(lines) != total {
		t.Fatalf("lines %d, want %d", len(lines), total)
	}
	seen := map[string]bool{}
	for _, line := range lines {
		var r store.Receipt
		if err := json.Unmarshal([]byte(line), &r); err != nil {
			t.Fatalf("line is not a receipt: %v: %s", err, line)
		}
		seen[r.Nonce] = true
	}
	if len(seen) != total {
		t.Fatalf("unique nonces %d, want %d", len(seen), total)
	}
}

func TestExportEmpty(t *testing.T) {
	h, _ := testServer()
	id, key := createPublisherForTest(t, h, "empty.example")

	csvBody := exportRequest(h, "/publishers/"+id+"/receipts/export?format=csv", key).Body.String()
	rows, err := csv.NewReader(strings.NewReader(csvBody)).ReadAll()
	if err != nil {
		t.Fatalf("parse csv: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("empty CSV rows %d, want just the header", len(rows))
	}

	jsonBody := exportRequest(h, "/publishers/"+id+"/receipts/export?format=json", key).Body.String()
	if strings.TrimSpace(jsonBody) != "" {
		t.Fatalf("empty JSON body %q", jsonBody)
	}
}

func TestExportRejectsBadInput(t *testing.T) {
	h, _ := testServer()
	id, key := createPublisherForTest(t, h, "bad.example")

	cases := []string{
		"/publishers/" + id + "/receipts/export?format=xml",
		"/publishers/" + id + "/receipts/export?from=not-a-date",
		"/publishers/" + id + "/receipts/export?from=2026-06-17T00:00:00Z&to=2026-06-16T00:00:00Z",
	}
	for _, path := range cases {
		if w := exportRequest(h, path, key); w.Code != http.StatusBadRequest {
			t.Fatalf("%s: status %d, want 400", path, w.Code)
		}
	}
}
