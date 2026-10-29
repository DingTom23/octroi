package config

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port           int
	Network        string
	DatabaseURL    string
	FacilitatorURL string
	// TrustedProxies is the list of proxy IPs/CIDRs whose forwarding headers
	// may be believed. An empty list means trust none, so ClientIP falls back
	// to the TCP peer address.
	TrustedProxies []string
}

var supportedNetworks = map[string]bool{
	"stellar-testnet": true,
	"stellar-mainnet": true,
}

// Load reads and validates the gateway configuration from the environment.
func Load() (Config, error) {
	port := 8080
	if v := os.Getenv("API_PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil || p < 1 || p > 65535 {
			return Config{}, fmt.Errorf("API_PORT must be an integer in [1, 65535]; got %q", v)
		}
		port = p
	}

	network := os.Getenv("OCTROI_NETWORK")
	if network == "" {
		network = "stellar-testnet"
	}
	if !supportedNetworks[network] {
		return Config{}, fmt.Errorf("OCTROI_NETWORK %q is not supported", network)
	}

	trustedProxies, err := parseTrustedProxies(os.Getenv("TRUSTED_PROXIES"))
	if err != nil {
		return Config{}, err
	}

	return Config{
		Port:           port,
		Network:        network,
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		FacilitatorURL: os.Getenv("NEXT_PUBLIC_FACILITATOR_URL"),
		TrustedProxies: trustedProxies,
	}, nil
}

// parseTrustedProxies accepts a comma-separated list of IPs and CIDRs.
// Empty (or whitespace) means trust no proxy. The returned slice is never nil
// so it can be passed to gin.Engine.SetTrustedProxies directly.
func parseTrustedProxies(raw string) ([]string, error) {
	out := []string{}
	if strings.TrimSpace(raw) == "" {
		return out, nil
	}
	for _, part := range strings.Split(raw, ",") {
		value := strings.TrimSpace(part)
		if value == "" {
			return nil, fmt.Errorf("TRUSTED_PROXIES contains an empty entry")
		}
		if net.ParseIP(value) != nil {
			out = append(out, value)
			continue
		}
		if _, _, err := net.ParseCIDR(value); err == nil {
			out = append(out, value)
			continue
		}
		return nil, fmt.Errorf("TRUSTED_PROXIES entry %q is not an IP or CIDR", value)
	}
	return out, nil
}
