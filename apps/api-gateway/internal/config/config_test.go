package config

import (
	"reflect"
	"testing"
)

func clearEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{"API_PORT", "OCTROI_NETWORK", "DATABASE_URL", "NEXT_PUBLIC_FACILITATOR_URL", "TRUSTED_PROXIES"} {
		t.Setenv(key, "")
	}
}

func TestLoadDefaults(t *testing.T) {
	clearEnv(t)
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Port != 8080 || cfg.Network != "stellar-testnet" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if cfg.TrustedProxies == nil || len(cfg.TrustedProxies) != 0 {
		t.Fatalf("trusted proxies must be an empty non-nil slice, got %#v", cfg.TrustedProxies)
	}
}

func TestTrustedProxies(t *testing.T) {
	cases := []struct {
		name    string
		raw     string
		want    []string
		wantErr bool
	}{
		{name: "empty", raw: "", want: []string{}},
		{name: "whitespace", raw: "   ", want: []string{}},
		{name: "ipv4", raw: "10.0.0.1", want: []string{"10.0.0.1"}},
		{name: "ipv6", raw: "::1", want: []string{"::1"}},
		{name: "cidr", raw: "10.0.0.0/8", want: []string{"10.0.0.0/8"}},
		{name: "list", raw: "10.0.0.1, 192.168.0.0/16, ::1", want: []string{"10.0.0.1", "192.168.0.0/16", "::1"}},
		{name: "invalid", raw: "not-an-ip", wantErr: true},
		{name: "empty entry", raw: "10.0.0.1,,192.168.0.1", wantErr: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			clearEnv(t)
			t.Setenv("TRUSTED_PROXIES", tc.raw)
			cfg, err := Load()
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %+v", cfg)
				}
				return
			}
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			if !reflect.DeepEqual(cfg.TrustedProxies, tc.want) {
				t.Fatalf("got %#v, want %#v", cfg.TrustedProxies, tc.want)
			}
		})
	}
}

func TestLoadRejectsInvalidPort(t *testing.T) {
	clearEnv(t)
	t.Setenv("API_PORT", "70000")
	if _, err := Load(); err == nil {
		t.Fatal("expected an error for an out-of-range port")
	}
}

func TestLoadRejectsUnknownNetwork(t *testing.T) {
	clearEnv(t)
	t.Setenv("OCTROI_NETWORK", "stellar-devnet")
	if _, err := Load(); err == nil {
		t.Fatal("expected an error for an unknown network")
	}
}
