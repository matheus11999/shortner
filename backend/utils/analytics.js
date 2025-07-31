const crypto = require('crypto');

class AnalyticsUtils {
  
  // Gerar session ID único baseado em IP + User Agent
  static generateSessionId(ip, userAgent) {
    const hash = crypto.createHash('sha256');
    hash.update(ip + userAgent + Date.now().toString());
    return hash.digest('hex').substring(0, 32);
  }
  
  // Detectar tipo de dispositivo
  static detectDeviceType(userAgent) {
    const ua = userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      return 'mobile';
    } else if (/tablet|ipad/i.test(ua)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }
  
  // Detectar browser
  static detectBrowser(userAgent) {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('edg')) return 'Edge';
    if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
    if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer';
    
    return 'Unknown';
  }
  
  // Detectar sistema operacional
  static detectOS(userAgent) {
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac os')) return 'macOS';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('ubuntu')) return 'Ubuntu';
    
    return 'Unknown';
  }
  
  // Obter IP real do usuário (considerando proxies)
  static getRealIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
  }
  
  // Detectar país/cidade por IP (simulação - em produção usar serviço real)
  static async detectLocation(ip) {
    // Em produção, integrar com serviço como MaxMind GeoIP, ip-api.com, etc.
    // Por agora, retorna dados simulados
    
    if (ip === '127.0.0.1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
      return {
        country: 'Brasil',
        city: 'Local'
      };
    }
    
    // Simulação de diferentes países
    const locations = [
      { country: 'Brasil', city: 'São Paulo' },
      { country: 'Brasil', city: 'Rio de Janeiro' },
      { country: 'Brasil', city: 'Belo Horizonte' },
      { country: 'Portugal', city: 'Lisboa' },
      { country: 'Estados Unidos', city: 'Nova York' }
    ];
    
    return locations[Math.floor(Math.random() * locations.length)];
  }
  
  // Registrar ou atualizar visitante único
  static async trackUniqueVisitor(database, sessionId, ip, userAgent) {
    try {
      // Verificar se já existe
      const existing = database.get(
        'SELECT * FROM unique_visitors WHERE session_id = ?',
        [sessionId]
      );
      
      if (existing) {
        // Atualizar última visita e contador
        database.run(
          'UPDATE unique_visitors SET last_visit = CURRENT_TIMESTAMP, visit_count = visit_count + 1 WHERE session_id = ?',
          [sessionId]
        );
        return false; // Não é novo
      } else {
        // Criar novo visitante
        database.run(
          'INSERT INTO unique_visitors (session_id, ip_address, user_agent) VALUES (?, ?, ?)',
          [sessionId, ip, userAgent]
        );
        return true; // É novo
      }
    } catch (err) {
      console.error('Error tracking unique visitor:', err);
      return false;
    }
  }
  
  // Coletar dados completos do analytics
  static async collectAnalyticsData(req) {
    const ip = this.getRealIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const sessionId = this.generateSessionId(ip, userAgent);
    const location = await this.detectLocation(ip);
    
    return {
      sessionId,
      ip,
      userAgent,
      referrer: req.headers.referer || '',
      deviceType: this.detectDeviceType(userAgent),
      browser: this.detectBrowser(userAgent),
      os: this.detectOS(userAgent),
      country: location.country,
      city: location.city,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AnalyticsUtils;