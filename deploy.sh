#!/bin/bash

# Script para fazer deploy automatizado do backend
echo "🚀 Starting automated backend deploy..."

# Fazer commit e push
echo "📦 Adding changes to git..."
git add .

echo "💬 Creating commit..."
git commit -m "Fix: Add CORS support for EasyPanel frontend domain"

echo "📤 Pushing to GitHub..."
git push origin backend

# Verificar se o push foi bem-sucedido
if [ $? -eq 0 ]; then
    echo "✅ Push successful! Triggering deploy webhook..."
    
    # Acionar webhook de deploy
    curl -X POST http://89.28.236.67:3000/api/deploy/323222aea130092bcbd96931b347bb9aafee773bb1346b1e
    
    if [ $? -eq 0 ]; then
        echo "🎉 Deploy webhook triggered successfully!"
        echo "🔄 Backend should be updating now..."
    else
        echo "❌ Failed to trigger deploy webhook"
        exit 1
    fi
else
    echo "❌ Git push failed"
    exit 1
fi

echo "✅ Deploy process completed!"