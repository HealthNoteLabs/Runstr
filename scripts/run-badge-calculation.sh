#!/bin/bash
# RUNSTR Weekly Badge Calculation Helper Script
# Unix/Linux Shell Script

set -e  # Exit on any error

echo ""
echo "========================================"
echo "    RUNSTR Weekly Badge Calculator"
echo "========================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Function to show help
show_help() {
    echo "Usage:"
    echo "  ./run-badge-calculation.sh              - Run weekly badge calculation"
    echo "  ./run-badge-calculation.sh --dry-run    - Preview weekly changes only"
    echo "  ./run-badge-calculation.sh --catchup    - Award ALL existing users their badges"
    echo "  ./run-badge-calculation.sh --catchup-dry - Preview catchup awards only"
    echo "  ./run-badge-calculation.sh --help       - Show this help"
    echo ""
    echo "Output files:"
    echo "  scripts/badge-tracking.json            - User progress tracking"
    echo "  scripts/badge-recipients-YYYY-MM-DD.json - Weekly badge recipients"
    echo "  scripts/badge-catchup-YYYY-MM-DD.json - Catchup badge recipients"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    --dry-run)
        echo "Running in DRY RUN mode - no data will be saved"
        echo ""
        node scripts/calculate-weekly-badges.mjs --dry-run
        ;;
    --catchup)
        echo "Running RETROACTIVE CATCHUP - awarding all existing users their badges!"
        echo "Press Ctrl+C to cancel within 10 seconds..."
        sleep 10
        echo ""
        node scripts/calculate-weekly-badges.mjs --catchup
        ;;
    --catchup-dry)
        echo "Running CATCHUP DRY RUN - preview existing users who need badges"
        echo ""
        node scripts/calculate-weekly-badges.mjs --catchup --dry-run
        ;;
    --help)
        show_help
        exit 0
        ;;
    "")
        echo "Running FULL weekly badge calculation - data will be updated"
        echo "Press Ctrl+C to cancel within 5 seconds..."
        sleep 5
        echo ""
        node scripts/calculate-weekly-badges.mjs
        ;;
    *)
        echo "Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

echo ""
echo "Script completed. Check output above for results."

# Don't auto-close terminal in some environments
if [[ -t 1 ]]; then
    echo "Press Enter to continue..."
    read -r
fi