interface GeoProperties {
  asn: number;
  countryName: string;
  countryCodeAlpha2: string;
  countryCodeAlpha3: string;
  countryCodeNumeric: string;
  regionName: string;
  regionCode: string;
  cityName: string;
  latitude: number;
  longitude: number;
  cisp: string;
}

interface IncomingRequestEoProperties {
  geo: GeoProperties;
  uuid: string;
  clientIp: string;
}

interface EORequest extends Request {
  readonly eo: IncomingRequestEoProperties;
}

// 处理 OPTIONS 预检请求
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    },
  });
}

// 处理所有请求
export async function onRequest({ request }: { request: EORequest }) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // 从请求中获取API Key
  const API_KEY = request.headers.get('X-API-Key') || 
                 url.searchParams.get('api_key') || 
                 url.searchParams.get('key');

  // 健康检查端点
  if (pathname === '/health' || pathname === '/ping') {
    return new Response(JSON.stringify({
      status: 'ok',
      platform: 'EdgeOne Pages',
      timestamp: new Date().toISOString(),
      client_ip: request.eo?.clientIp || 'unknown',
      country: request.eo?.geo?.countryCodeAlpha2 || 'unknown'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 管理端点
  if (pathname === '/admin/status' && API_KEY && API_KEY.length === 32) {
    return new Response(JSON.stringify({
      status: 'active',
      version: '2.0.0-EdgeOne-TMDB',
      platform: 'EdgeOne Pages',
      endpoints: { 
        images: '/t/p/{size}/{path}', 
        api: '/3/{endpoint}',
        health: '/health',
        admin: '/admin/status'
      },
      client_info: { 
        ip: request.eo?.clientIp || 'unknown', 
        country: request.eo?.geo?.countryCodeAlpha2 || 'unknown'
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 根路径 - 伪装404页面
  if (pathname === '/' || pathname === '') {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .error { font-size: 72px; color: #999; margin-bottom: 20px; }
        .message { font-size: 18px; color: #666; margin-bottom: 30px; }
        .info { font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <div class="error">404</div>
    <div class="message">Page Not Found</div>
    <div class="info">EdgeOne Pages</div>
    <script>
        console.log('🎬 TMDB Proxy Service - EdgeOne Pages');
        console.log('Platform: EdgeOne Pages Function');
        console.log('Endpoints:');
        console.log('  • Images: /t/p/{size}/{path}');
        console.log('  • API: /3/{endpoint} (requires API key)');
        console.log('  • Health: /health, /ping');
        console.log('  • Admin: /admin/status (requires API key)');
        console.log('API Key Methods:');
        console.log('  • Header: X-API-Key: your_api_key');
        console.log('  • URL Param: ?api_key=your_api_key');
        console.log('  • URL Param: ?key=your_api_key');
        console.log('⚠️ Service disguised as 404 for security');
    </script>
</body>
</html>`;
    
    return new Response(html, {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 图片代理 /t/p/*
  if (pathname.startsWith('/t/p/')) {
    // 设置目标域名为TMDB图片服务器
    url.hostname = "image.tmdb.org";

    // 请求头处理，去除可能导致错误的 headers
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("Accept-Encoding");
    headers.set("User-Agent", "Mozilla/5.0 (compatible; EdgeOne-TMDB-Proxy/1.0)");

    // 请求体处理，仅在允许的情况下传递 body
    const method = request.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);

    // 生成回源请求
    const req = new Request(url.toString(), {
      method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "follow",
    });

    try {
      // 发起请求，返回只读属性的响应
      const response = await fetch(req);

      if (!response.ok) {
        // 图片不存在时返回404页面而不是暴露错误
        return new Response('Not Found', {
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 拷贝响应，方便后续修改
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      // 处理响应头
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Cache-Control", "public, max-age=604800, immutable");

      // 返回响应
      return newResponse;
    } catch (e: any) {
      // 返回404而不是暴露错误信息
      return new Response('Service Unavailable', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  // API代理 /3/*
  if (pathname.startsWith('/3/')) {
    // 检查API Key
    if (!API_KEY) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 设置目标域名为TMDB API服务器
    url.hostname = "api.tmdb.org";
    
    // 自动添加API Key
    if (!url.searchParams.has('api_key')) {
      url.searchParams.set('api_key', API_KEY);
    }

    // 请求头处理，去除可能导致错误的 headers
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("Accept-Encoding");
    headers.set("Accept", "application/json");
    headers.set("User-Agent", "Mozilla/5.0 (compatible; EdgeOne-TMDB-Proxy/1.0)");

    // 请求体处理，仅在允许的情况下传递 body
    const method = request.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);

    // 生成回源请求
    const req = new Request(url.toString(), {
      method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "follow",
    });

    try {
      // 发起请求，返回只读属性的响应
      const response = await fetch(req);

      // 拷贝响应，方便后续修改
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      // 处理响应头
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Content-Type", "application/json");
      
      // 智能缓存控制
      const cacheTime = pathname.includes('configuration') ? 3600 : // 配置1小时
                       pathname.includes('search') ? 300 :           // 搜索5分钟
                       pathname.includes('popular') ? 1800 :         // 热门30分钟
                       600; // 默认10分钟
      newResponse.headers.set("Cache-Control", `public, max-age=${cacheTime}`);

      // 返回响应
      return newResponse;
    } catch (e: any) {
      // 返回错误
      return new Response(
        JSON.stringify({ error: 'API request failed', message: e?.message || String(e) }),
        {
          status: 502,
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }

  // 其他路径返回404
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
