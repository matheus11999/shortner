#!/bin/bash

# Script para fazer deploy automatizado do frontend
echo "🎨 Starting automated frontend deploy..."

# Verificar se a variável BACKEND_URL foi passada
if [ -z "$1" ]; then
    echo "❌ Usage: ./deploy-frontend.sh <BACKEND_URL>"
    echo "   Example: ./deploy-frontend.sh https://backend-url.123.easypanel.app"
    exit 1
fi

BACKEND_URL=$1

echo "🔧 Updating API URL to: ${BACKEND_URL}/api"

# Atualizar o .env.example com a URL do backend
cat > .env.example << EOF
# Frontend Environment Variables
VITE_API_URL=${BACKEND_URL}/api
VITE_APP_TITLE=URL Shortener
VITE_APP_VERSION=1.0.0
EOF

echo "📦 Adding changes to git..."
git add .

echo "💬 Creating commit..."
git commit -m "Update: Configure API URL for production deployment"

echo "📤 Pushing to GitHub..."
git push origin frontend

# Verificar se o push foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Push successful!"
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "1. Configure environment variable in EasyPanel:"
    echo "   VITE_API_URL=${BACKEND_URL}/api"
    echo ""
    echo "2. Redeploy the frontend in EasyPanel"
    echo ""
    echo "✅ Frontend deploy ready!"
else
    echo "❌ Git push failed"
    exit 1
fi