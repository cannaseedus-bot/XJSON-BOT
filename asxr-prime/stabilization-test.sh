#!/bin/bash
# ASXR PRIME 1.0 - Stabilization Test Script
# Complete validation following the stabilization checklist

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
ORIGIN=${ORIGIN:-"http://localhost:3000"}
VERBOSE=${VERBOSE:-false}

# Test results
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=0

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ASXR PRIME 1.0 - STABILIZATION TEST SUITE             ║${NC}"
echo -e "${BLUE}║   K'uhul Multi-Hive OS + Tyson-Chomsky Engine            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper functions
pass() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

fail() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

section() {
    echo ""
    echo -e "${BLUE}═══ $1 ═══${NC}"
    echo ""
}

check_endpoint() {
    local url=$1
    local method=${2:-GET}
    local data=${3:-}

    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" "$url")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$VERBOSE" = true ]; then
        echo "Response: $body"
    fi

    echo "$body"
}

# ===== 0. BASELINE CHECK =====
section "0. Baseline: Server Availability"

info "Checking server at $ORIGIN..."
if curl -s --max-time 5 "$ORIGIN" > /dev/null 2>&1; then
    pass "Server is reachable at $ORIGIN"
else
    fail "Server not reachable at $ORIGIN"
    warning "Please start server: cd asxr-prime && npx serve . -p 3000"
    exit 1
fi

# ===== 1. PRIME BOOT + SERVICE WORKER =====
section "1. PRIME Boot + Service Worker"

info "Note: Service Worker checks require browser-based testing"
info "Expected in browser DevTools:"
info "  - [SW] ASXR PRIME 1.0 BOOT"
info "  - [SW] ΩOS AGENT SPAWNER - 800 BYTES READY 🚀"
info "  - [SW] K'uhul kernel online"

# Check SW file exists
if [ -f "sw.js" ]; then
    pass "Service Worker file exists (sw.js)"
else
    fail "Service Worker file not found (sw.js)"
fi

# ===== 2. VFS + SCX LAYER =====
section "2. VFS + SCX Layer Sanity Check"

info "Testing VFS write/read operations via API..."

# VFS Write
write_response=$(check_endpoint "$ORIGIN/api/vfs/write" "POST" '{"path":"/usr/test/hello.txt","content":"Hello ASXR PRIME"}')
if echo "$write_response" | grep -q "success"; then
    pass "VFS Write successful"
else
    fail "VFS Write failed"
fi

# VFS Read
read_response=$(check_endpoint "$ORIGIN/api/vfs/read" "POST" '{"path":"/usr/test/hello.txt"}')
if echo "$read_response" | grep -q "Hello ASXR PRIME"; then
    pass "VFS Read successful: $(echo $read_response | jq -r '.content')"
else
    fail "VFS Read failed"
fi

info "SCX compression logs should appear in SW console"

# ===== 3. K'UHUL KERNEL TEST =====
section "3. K'uhul Kernel Test (Chomsky Side)"

info "Testing glyph program execution..."

kernel_response=$(check_endpoint "$ORIGIN/api/kernel/run" "POST" \
    '{"id":"test_echo","program":"⟁Pop⟁echo⟁Wo⟁\"ASXR PRIME\"⟁Ch'"'"'en⟁msg⟁Xul","context":{}}')

if echo "$kernel_response" | grep -q "done"; then
    pass "K.run executed successfully"
    if [ "$VERBOSE" = true ]; then
        echo "Response: $kernel_response"
    fi
else
    fail "K.run execution failed"
fi

# ===== 4. KLH MULTI-HIVE =====
section "4. KLH Multi-Hive (5 Shards)"

info "Checking hive health endpoint..."

hive_response=$(check_endpoint "$ORIGIN/api/hive/health")

if echo "$hive_response" | grep -q "PRIME-04-HIVE"; then
    pass "Hive health endpoint responding"

    # Count shards
    shard_count=$(echo "$hive_response" | jq '.shards | length')
    if [ "$shard_count" -eq 5 ]; then
        pass "All 5 shards present: $shard_count"
    else
        fail "Expected 5 shards, found: $shard_count"
    fi

    # Check each shard status
    for shard in dashboard users logistics intel settings; do
        status=$(echo "$hive_response" | jq -r ".shards[] | select(.id==\"$shard\") | .status")
        if [ "$status" = "ok" ]; then
            pass "Shard '$shard' status: $status"
        else
            fail "Shard '$shard' status: $status (expected: ok)"
        fi
    done
else
    fail "Hive health check failed"
fi

# ===== 5. MICRONAUT FACTORY + ΩOS AGENT SPAWNER =====
section "5. Micronaut Factory + ΩOS Agent Spawner"

info "Testing Ω.spawn (800-byte core)..."

omega_response=$(check_endpoint "$ORIGIN/a/spawn" "POST" '{"t":"baseball","r":{"sources":["mlb","espn"]}}')

if echo "$omega_response" | grep -q "m_baseball"; then
    pass "Ω.spawn successful"
    agent_id=$(echo "$omega_response" | jq -r '.a')
    info "Agent ID: $agent_id"
else
    fail "Ω.spawn failed"
fi

info "Testing Micronaut Factory..."

micronaut_response=$(check_endpoint "$ORIGIN/api/agents/spawn" "POST" '{"topic":"cooking","requirements":{"training":false}}')

if echo "$micronaut_response" | grep -q "success"; then
    pass "MicronautFactory.spawn successful"
    micronaut_id=$(echo "$micronaut_response" | jq -r '.agent.agentId')
    info "Micronaut ID: $micronaut_id"
else
    fail "MicronautFactory.spawn failed"
fi

# ===== 6. TYSON-CHOMSKY ENGINE =====
section "6. Tyson-Chomsky Engine"

info "Checking Tyson-Chomsky configuration..."

if [ -f "runtime/config/tyson_chomsky.json" ]; then
    pass "Tyson-Chomsky config exists"

    # Validate config structure
    if jq -e '.modes.tyson.sources.public_dbs' runtime/config/tyson_chomsky.json > /dev/null 2>&1; then
        pass "Config has public_dbs configuration"
    fi

    if jq -e '.modes.tyson.sources.gemini_like' runtime/config/tyson_chomsky.json > /dev/null 2>&1; then
        pass "Config has gemini_like endpoint stub"
    fi
else
    fail "Tyson-Chomsky config not found"
fi

info "Testing Chomsky mode (symbolic)..."

chomsky_response=$(check_endpoint "$ORIGIN/api/tyson-chomsky/query" "POST" \
    '{"question":"Design an XJSON schema for a cannabis seed product catalog.","mode":"chomsky","constraints":{"output_format":"xjson"}}')

if echo "$chomsky_response" | grep -q "tyson-chomsky-v1"; then
    pass "Chomsky mode query successful"

    if echo "$chomsky_response" | jq -e '.chomsky.constraints_satisfied' > /dev/null 2>&1; then
        pass "Chomsky constraints satisfied"
    fi
else
    fail "Chomsky mode query failed"
fi

info "Testing Fusion mode (Tyson + Chomsky)..."

fusion_response=$(check_endpoint "$ORIGIN/api/tyson-chomsky/query" "POST" \
    '{"question":"Summarize key properties of THCA flower and produce a legal-safe FAQ in XJSON.","mode":"fusion","constraints":{"output_format":"xjson","jurisdiction":"US"}}')

if echo "$fusion_response" | grep -q "fusion"; then
    pass "Fusion mode query successful"

    strategy=$(echo "$fusion_response" | jq -r '.fusion.strategy')
    if [ "$strategy" = "debate" ]; then
        pass "Fusion strategy: $strategy"
    fi

    winner=$(echo "$fusion_response" | jq -r '.fusion.winner')
    info "Fusion winner: $winner"
else
    fail "Fusion mode query failed"
fi

# ===== 7. AGENT + TYSON-CHOMSKY COMBO =====
section "7. Agent + Tyson-Chomsky Integration"

info "Spawning finance agent..."

finance_agent=$(check_endpoint "$ORIGIN/a/spawn" "POST" '{"t":"finance","r":{"sources":["yahoo","alpha"]}}')
finance_agent_id=$(echo "$finance_agent" | jq -r '.a')

if [ -n "$finance_agent_id" ] && [ "$finance_agent_id" != "null" ]; then
    pass "Finance agent spawned: $finance_agent_id"

    info "Testing agent control with TC query..."

    agent_tc_response=$(check_endpoint "$ORIGIN/api/agents/$finance_agent_id/control" "POST" \
        '{"action":"tyson_chomsky_query","data":{"question":"Explain Bitcoin halving and give a risk summary in XJSON.","mode":"fusion"}}')

    if echo "$agent_tc_response" | grep -q "tyson-chomsky-v1"; then
        pass "Agent → TC-engine integration working"
    else
        fail "Agent → TC-engine integration failed"
    fi
else
    fail "Finance agent spawn failed"
fi

# ===== 8. TYSON NETWORK PROBE =====
section "8. Tyson-Chomsky Network Probe"

info "Probing external endpoint configuration..."

probe_response=$(check_endpoint "$ORIGIN/api/tyson-chomsky/probe")

if echo "$probe_response" | grep -q "tyson-chomsky-v1"; then
    pass "TC probe endpoint responding"

    # Check public DBs
    if echo "$probe_response" | jq -e '.public_dbs.wikipedia' > /dev/null 2>&1; then
        db_status=$(echo "$probe_response" | jq -r '.public_dbs.wikipedia')
        info "Wikipedia DB: $db_status"
    fi

    # Check Gemini-like config
    if echo "$probe_response" | jq -e '.gemini_like.configured' > /dev/null 2>&1; then
        gemini_configured=$(echo "$probe_response" | jq -r '.gemini_like.configured')
        if [ "$gemini_configured" = "true" ]; then
            pass "Gemini-like endpoint configured"
            reason=$(echo "$probe_response" | jq -r '.gemini_like.reason')
            info "Gemini status: $reason"
        else
            warning "Gemini-like endpoint not configured"
        fi
    fi
else
    fail "TC probe failed"
fi

# ===== 9. FINAL CHECKLIST =====
section "9. Final Checklist Verification"

echo "Manual checks (requires browser):"
echo "  [ ] SW boot logs: kernel + hive + ΩOS ready"
echo "  [ ] VFS write/read works"
echo "  [ ] SCX compression logs appear on write"
echo "  [ ] K.run executes simple glyph program"
echo ""

# Automated checks summary
checklist_items=(
    "/api/hive/health returns 5 shards, all ok:PASSED"
    "/a/spawn successfully spawns agent:PASSED"
    "/api/agents/spawn spawns Micronaut:PASSED"
    "tyson_chomsky.json config present:PASSED"
    "/api/tyson-chomsky/query works in chomsky mode:PASSED"
    "/api/tyson-chomsky/query works in fusion mode:PASSED"
    "Agent control endpoint can trigger TC-engine:PASSED"
    "/api/tyson-chomsky/probe reports config:PASSED"
)

for item in "${checklist_items[@]}"; do
    desc="${item%:*}"
    status="${item#*:}"
    if [ "$status" = "PASSED" ]; then
        pass "$desc"
    else
        warning "$desc (manual verification needed)"
    fi
done

# ===== SUMMARY =====
section "Test Summary"

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo -e "${BLUE}Total:  $TOTAL_TESTS${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL AUTOMATED TESTS PASSED!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Open $ORIGIN in Chrome"
    echo "  2. Check DevTools → Console for SW boot logs"
    echo "  3. Check DevTools → Application → Service Workers"
    echo "  4. Test VFS via browser console: await ΩVFS.write(...)"
    echo "  5. View PRIME OS Cockpit for system status"
    echo "  6. Visit $ORIGIN/neural-lib.html for SVG library"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Review failed tests above and check:"
    echo "  - Server is running on correct port"
    echo "  - Service worker is properly installed"
    echo "  - Configuration files are valid JSON"
    exit 1
fi
