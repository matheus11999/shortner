#!/bin/bash

# Script para fazer deploy automatizado do frontend
echo "🎨 Starting automated frontend deploy..."

# Atualizar o .env.example com a URL do backend
cat > .env.example << EOF
# Frontend Environment Variables
VITE_API_URL=https://evoapi-backend-url.ttvjwi.easypanel.host/api
VITE_APP_TITLE=URL Shortener
VITE_APP_VERSION=1.0.0
EOF

echo "📦 Adding changes to git..."
git add .

echo "💬 Creating commit..."
git commit -m "Update: Configure API URL for EasyPanel production deployment"

echo "📤 Pushing to GitHub..."
git push origin frontend

# Verificar se o push foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Push successful! Triggering deploy webhook..."
    
    # Acionar webhook de deploy do frontend
    curl -X POST http://89.28.236.67:3000/api/deploy/91500480fcec14dbc6170bd5c290d28a19051545daca5659
    
    if [ $? -eq 0 ]; then
        echo "🎉 Deploy webhook triggered successfully!"
        echo "🔄 Frontend should be updating now..."
        echo ""
        echo "🎯 REMEMBER TO SET ENVIRONMENT VARIABLE IN EASYPANEL:"
        echo "   VITE_API_URL=https://evoapi-backend-url.ttvjwi.easypanel.host/api"
    else
        echo "❌ Failed to trigger deploy webhook"
        exit 1
    fi
else
    echo "❌ Git push failed"
    exit 1
fi

echo "✅ Frontend deploy process completed!"