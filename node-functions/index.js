// TMDB Proxy for EdgeOne Pages - 稳定版本
// 修复会话和缓存问题

export const onRequest = async (context) => {
  try {
    const { request, env } = context;
    
    // 添加详细日志用于调试
    console.log('=== Request Start ===');
    console.log('URL:', request.url);
    console.log('Method:', request.method);
    console.log('Timestamp:', new Date().toISOString());
    
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 处理OPTIONS请求
    if (request.method === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
          "Cache-Control": "no-cache", // 防止OPTIONS被缓存
        },
      });
    }

    // 从请求中获取API Key
    const API_KEY = request.headers.get('X-API-Key') || 
                   url.searchParams.get('api_key') || 
                   url.searchParams.get('key');

    // 获取客户端信息
    const clientIp = request.headers.get('eo-connecting-ip') || 
                     request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';

    console.log('Client IP:', clientIp);
    console.log('User Agent:', userAgent.substring(0, 50));

    // 健康检查端点
    if (pathname === '/health' || pathname === '/ping') {
      console.log('Health check requested');
      return new Response(JSON.stringify({
        status: 'ok',
        platform: 'EdgeOne Pages',
        timestamp: new Date().toISOString(),
        client_ip: clientIp,
        version: '1.0.2-Stable',
        session_id: Math.random().toString(36).substring(7) // 用于调试会话问题
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache', // 健康检查不缓存
        },
      });
    }

    // 根路径
    if (pathname === '/' || pathname === '') {
      console.log('Root path requested');
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TMDB Proxy Service</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .title { font-size: 28px; color: #333; margin-bottom: 20px; }
        .status { font-size: 18px; color: #28a745; margin-bottom: 30px; }
        .test-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
        .test-btn:hover { background: #0056b3; }
        .result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; text-align: left; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <div class="title">🎬 TMDB Proxy Service</div>
        <div class="status">✅ Service is running (Session: ${Math.random().toString(36).substring(7)})</div>
        
        <button class="test-btn" onclick="testImage()">测试图片代理</button>
        <button class="test-btn" onclick="testHealth()">测试健康检查</button>
        
        <div id="result" class="result" style="display:none;"></div>
    </div>
    
    <script>
        function showResult(text) {
            const result = document.getElementById('result');
            result.textContent = text;
            result.style.display = 'block';
        }
        
        async function testHealth() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                showResult('健康检查成功:\\n' + JSON.stringify(data, null, 2));
            } catch (error) {
                showResult('健康检查失败: ' + error.message);
            }
        }
        
        async function testImage() {
            try {
                const testUrl = '/t/p/w500/bxmAk4Qf7yf7vMhuev1Vw4nxbLK.jpg';
                const response = await fetch(testUrl);
                if (response.ok) {
                    showResult('图片代理成功!\\n状态码: ' + response.status + '\\n类型: ' + response.headers.get('Content-Type'));
                    // 显示图片
                    const img = document.createElement('img');
                    img.src = testUrl;
                    img.style.maxWidth = '300px';
                    img.style.marginTop = '10px';
                    document.getElementById('result').appendChild(img);
                } else {
                    showResult('图片代理失败\\n状态码: ' + response.status);
                }
            } catch (error) {
                showResult('图片代理失败: ' + error.message);
            }
        }
        
        console.log('🎬 TMDB Proxy Service - EdgeOne Pages');
        console.log('Session ID: ${Math.random().toString(36).substring(7)}');
        console.log('Timestamp: ${new Date().toISOString()}');
    </script>
</body>
</html>`;
      
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache', // 主页不缓存，避免状态问题
        },
      });
    }

    // 图片代理 /t/p/*
    if (pathname.startsWith('/t/p/')) {
      console.log('Image proxy requested:', pathname);
      
      try {
        const imageUrl = `https://image.tmdb.org${pathname}`;
        console.log('Fetching image from:', imageUrl);
        
        // 添加重试机制
        let response;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          attempts++;
          console.log(`Image fetch attempt ${attempts}/${maxAttempts}`);
          
          try {
            response = await fetch(imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; EdgeOne-TMDB-Proxy/1.0)',
                'Accept': 'image/*',
                'Cache-Control': 'no-cache' // 强制获取最新图片
              },
              // 添加超时控制
              signal: AbortSignal.timeout(10000) // 10秒超时
            });
            
            if (response.ok) {
              console.log('Image fetch successful on attempt', attempts);
              break;
            } else {
              console.log(`Image fetch failed on attempt ${attempts}, status:`, response.status);
              if (attempts === maxAttempts) {
                throw new Error(`Failed after ${maxAttempts} attempts, last status: ${response.status}`);
              }
              // 短暂延迟后重试
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (fetchError) {
            console.log(`Fetch error on attempt ${attempts}:`, fetchError.message);
            if (attempts === maxAttempts) {
              throw fetchError;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (!response || !response.ok) {
          console.log('All image fetch attempts failed');
          return new Response('Image not found', {
            status: 404,
            headers: {
              'Content-Type': 'text/plain',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache',
            },
          });
        }

        console.log('Image fetch successful, creating response');
        
        // 读取图片数据
        const imageData = await response.arrayBuffer();
        console.log('Image data size:', imageData.byteLength);

        // 创建新响应
        const newResponse = new Response(imageData, {
          status: 200,
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600, must-revalidate', // 1小时缓存，但允许重新验证
            'ETag': `"${Date.now()}-${imageData.byteLength}"`, // 添加ETag
            'Last-Modified': new Date().toUTCString(),
            'X-Proxy-Status': 'success',
            'X-Attempts': attempts.toString()
          },
        });

        console.log('Image response created successfully');
        return newResponse;

      } catch (error) {
        console.error('Image proxy error:', error);
        return new Response(JSON.stringify({
          error: 'Image proxy failed',
          message: error.message,
          path: pathname,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    // API代理 /3/*
    if (pathname.startsWith('/3/')) {
      console.log('API proxy requested:', pathname);
      
      if (!API_KEY) {
        console.log('API Key missing');
        return new Response(JSON.stringify({
          error: 'API Key required',
          message: 'Please provide a valid TMDB API Key'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          },
        });
      }

      try {
        const apiUrl = new URL(`https://api.tmdb.org${pathname}${url.search}`);
        if (!apiUrl.searchParams.has('api_key')) {
          apiUrl.searchParams.set('api_key', API_KEY);
        }

        console.log('Fetching API from:', apiUrl.toString());

        const response = await fetch(apiUrl.toString(), {
          method: request.method,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; EdgeOne-TMDB-Proxy/1.0)'
          },
          body: request.method !== 'GET' ? request.body : undefined,
        });

        const data = await response.text();
        console.log('API response status:', response.status);

        return new Response(data, {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=300, must-revalidate', // 5分钟缓存
          },
        });

      } catch (error) {
        console.error('API proxy error:', error);
        return new Response(JSON.stringify({
          error: 'API request failed',
          message: error.message
        }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    // 管理端点
    if (pathname === '/admin/status' && API_KEY && API_KEY.length === 32) {
      console.log('Admin status requested');
      return new Response(JSON.stringify({
        status: 'active',
        version: '1.0.2-Stable',
        platform: 'EdgeOne Pages',
        timestamp: new Date().toISOString(),
        client_info: { ip: clientIp, user_agent: userAgent.substring(0, 50) }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 其他路径
    console.log('Unknown path requested:', pathname);
    return new Response(JSON.stringify({
      error: 'Not Found',
      path: pathname,
      available_endpoints: ['/health', '/t/p/{size}/{path}', '/3/{endpoint}']
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (globalError) {
    console.error('Global error:', globalError);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: globalError.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  }
};
