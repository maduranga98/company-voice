#!/bin/bash

# Company Voice Platform - Deployment Script
# This script helps deploy the application to Firebase

set -e  # Exit on error

echo "=================================="
echo "Company Voice Platform Deployment"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "ℹ $1"
}

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI is not installed"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

print_success "Firebase CLI found"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found"
    echo "Please create a .env file from .env.example and fill in your values"
    exit 1
fi

print_success ".env file found"

# Check if VITE_STRIPE_PUBLISHABLE_KEY is set
if grep -q "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE" .env || grep -q "VITE_STRIPE_PUBLISHABLE_KEY=$" .env; then
    print_warning "Stripe publishable key not configured in .env"
    echo "Billing features will not work without a valid Stripe key"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Show deployment options
echo ""
echo "What would you like to deploy?"
echo "1) Functions only (Cloud Functions)"
echo "2) Hosting only (Frontend)"
echo "3) Both Functions and Hosting"
echo "4) Cancel"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        print_info "Deploying Cloud Functions..."
        echo ""

        # Check if secrets are configured
        print_info "Checking if Stripe secrets are configured..."

        if ! firebase functions:secrets:access STRIPE_SECRET_KEY &> /dev/null; then
            print_warning "STRIPE_SECRET_KEY not found in Firebase Secret Manager"
            echo "You need to set it with: firebase functions:secrets:set STRIPE_SECRET_KEY"
            read -p "Continue deployment anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        else
            print_success "STRIPE_SECRET_KEY is configured"
        fi

        # Deploy functions
        firebase deploy --only functions

        if [ $? -eq 0 ]; then
            print_success "Cloud Functions deployed successfully!"
            echo ""
            print_info "Next steps:"
            echo "1. Test your functions by accessing billing pages"
            echo "2. Check logs with: firebase functions:log"
            echo "3. Configure Stripe webhooks if not done yet (see SETUP.md)"
        else
            print_error "Deployment failed"
            exit 1
        fi
        ;;

    2)
        echo ""
        print_info "Building frontend..."
        npm run build

        if [ $? -ne 0 ]; then
            print_error "Build failed"
            exit 1
        fi

        print_success "Build complete"

        print_info "Deploying to Firebase Hosting..."
        firebase deploy --only hosting

        if [ $? -eq 0 ]; then
            print_success "Frontend deployed successfully!"
            echo ""
            print_info "Your app is now live!"
        else
            print_error "Deployment failed"
            exit 1
        fi
        ;;

    3)
        echo ""
        print_info "Building frontend..."
        npm run build

        if [ $? -ne 0 ]; then
            print_error "Build failed"
            exit 1
        fi

        print_success "Build complete"

        print_info "Deploying both Functions and Hosting..."
        firebase deploy

        if [ $? -eq 0 ]; then
            print_success "Deployment successful!"
            echo ""
            print_info "Both Cloud Functions and Frontend are now live!"
            print_info "Check logs with: firebase functions:log"
        else
            print_error "Deployment failed"
            exit 1
        fi
        ;;

    4)
        print_info "Deployment cancelled"
        exit 0
        ;;

    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "=================================="
echo "Deployment Complete!"
echo "=================================="
