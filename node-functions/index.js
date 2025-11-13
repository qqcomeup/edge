// TMDB Proxy for EdgeOne Pages - 终极稳定版
// 专门处理EdgeOne的间歇性失败问题

// 全局变量用于实例状态跟踪
let instanceId = Math.random().toString(36).substring(7);
let requestCount = 0;
let lastRequestTime = Date.now();

export const onRequest = async (context) => {
  requestCount++;
  lastRequestTime = Date.now();
  
  console.log(`=== Request ${requestCount} (Instance: ${instanceId}) ===`);
  console.log('URL:', context.request.url);
  console.log('Method:', context.request.method);
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const { request } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 处理OPTIONS请求
    if (request.method === 'OPTIONS') {
      return createCORSResponse();
    }

    // 从请求中获取API Key
    const API_KEY = request.headers.get('X-API-Key') || 
                   url.searchParams.get('api_key') || 
                   url.searchParams.get('key');

    // 获取客户端信息
    const clientIp = request.headers.get('eo-connecting-ip') || 
                     request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     'unknown';

    // 实例状态端点 - 用于调试
    if (pathname === '/instance' || pathname === '/debug') {
      return new Response(JSON.stringify({
        instance_id: instanceId,
        request_count: requestCount,
        last_request: new Date(lastRequestTime).toISOString(),
        uptime_ms: Date.now() - (lastRequestTime - requestCount * 1000),
        platform: 'EdgeOne Pages',
        version: '1.0.3-Ultimate',
        status: 'active'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 健康检查端点
    if (pathname === '/health' || pathname === '/ping') {
      return new Response(JSON.stringify({
        status: 'ok',
        instance_id: instanceId,
        request_count: requestCount,
        platform: 'EdgeOne Pages',
        timestamp: new Date().toISOString(),
        client_ip: clientIp,
        version: '1.0.3-Ultimate'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 根路径 - 显示调试信息
    if (pathname === '/' || pathname === '') {
      const html = createDebugHTML(instanceId, requestCount);
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 图片代理 /t/p/* - 增强版
    if (pathname.startsWith('/t/p/')) {
      return await handleImageProxy(pathname, instanceId, requestCount);
    }

    // API代理 /3/*
    if (pathname.startsWith('/3/')) {
      if (!API_KEY) {
        return createErrorResponse(401, 'API Key required', 'Please provide a valid TMDB API Key');
      }
      return await handleAPIProxy(pathname, url.search, API_KEY, request);
    }

    // 管理端点
    if (pathname === '/admin/status' && API_KEY && API_KEY.length === 32) {
      return new Response(JSON.stringify({
        status: 'active',
        instance_id: instanceId,
        request_count: requestCount,
        version: '1.0.3-Ultimate',
        platform: 'EdgeOne Pages',
        timestamp: new Date().toISOString(),
        client_info: { ip: clientIp }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 未知路径
    return createErrorResponse(404, 'Not Found', `Path ${pathname} not found`);

  } catch (globalError) {
    console.error('Global error in instance', instanceId, ':', globalError);
    return createErrorResponse(500, 'Internal Server Error', globalError.message);
  }
};

// 处理图片代理的专用函数
async function handleImageProxy(pathname, instanceId, requestCount) {
  console.log(`[${instanceId}] Image proxy request ${requestCount}:`, pathname);
  
  try {
    const imageUrl = `https://image.tmdb.org${pathname}`;
    console.log(`[${instanceId}] Fetching:`, imageUrl);
    
    // 多重重试策略
    const maxAttempts = 5;
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[${instanceId}] Attempt ${attempt}/${maxAttempts}`);
      
      try {
        // 每次重试使用不同的策略
        const fetchOptions = {
          headers: {
            'User-Agent': `Mozilla/5.0 (EdgeOne-TMDB-Proxy/${instanceId}; attempt-${attempt})`,
            'Accept': 'image/*,*/*',
            'Accept-Encoding': 'identity', // 避免压缩问题
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          // 递增超时时间
          signal: AbortSignal.timeout(5000 + attempt * 2000)
        };
        
        const response = await fetch(imageUrl, fetchOptions);
        
        console.log(`[${instanceId}] Response status:`, response.status);
        
        if (response.ok) {
          console.log(`[${instanceId}] Success on attempt ${attempt}`);
          
          // 立即读取数据，避免流被中断
          const imageData = await response.arrayBuffer();
          console.log(`[${instanceId}] Image data size:`, imageData.byteLength);
          
          if (imageData.byteLength === 0) {
            throw new Error('Empty image data received');
          }
          
          // 创建稳定的响应
          return new Response(imageData, {
            status: 200,
            headers: {
              'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600', // 30分钟缓存，允许过期服务
              'X-Proxy-Instance': instanceId,
              'X-Proxy-Attempt': attempt.toString(),
              'X-Proxy-Request': requestCount.toString(),
              'Content-Length': imageData.byteLength.toString(),
              'Last-Modified': new Date().toUTCString()
            },
          });
        } else if (response.status === 404) {
          // 404是真实的，不需要重试
          console.log(`[${instanceId}] Image not found (404)`);
          return createErrorResponse(404, 'Image not found', `Image ${pathname} does not exist`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (fetchError) {
        lastError = fetchError;
        console.log(`[${instanceId}] Attempt ${attempt} failed:`, fetchError.message);
        
        if (attempt < maxAttempts) {
          // 指数退避延迟
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[${instanceId}] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 所有重试都失败了
    console.error(`[${instanceId}] All ${maxAttempts} attempts failed. Last error:`, lastError?.message);
    return createErrorResponse(502, 'Image proxy failed', `Failed after ${maxAttempts} attempts: ${lastError?.message}`);
    
  } catch (error) {
    console.error(`[${instanceId}] Image proxy error:`, error);
    return createErrorResponse(500, 'Image proxy error', error.message);
  }
}

// 处理API代理的专用函数
async function handleAPIProxy(pathname, search, apiKey, request) {
  try {
    const apiUrl = new URL(`https://api.tmdb.org${pathname}${search}`);
    if (!apiUrl.searchParams.has('api_key')) {
      apiUrl.searchParams.set('api_key', apiKey);
    }

    const response = await fetch(apiUrl.toString(), {
      method: request.method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; EdgeOne-TMDB-Proxy/1.0)'
      },
      body: request.method !== 'GET' ? request.body : undefined,
    });

    const data = await response.text();
    
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });

  } catch (error) {
    return createErrorResponse(502, 'API request failed', error.message);
  }
}

// 创建CORS响应
function createCORSResponse() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      "Cache-Control": "no-cache",
    },
  });
}

// 创建错误响应
function createErrorResponse(status, error, message) {
  return new Response(JSON.stringify({
    error,
    message,
    instance_id: instanceId,
    request_count: requestCount,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  });
}

// 创建调试HTML页面
function createDebugHTML(instanceId, requestCount) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TMDB Proxy - Debug Mode</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; }
        .header { background: linear-gradient(135deg, #ff6b6b, #ee5a24); color: white; padding: 30px; text-align: center; }
        .title { font-size: 28px; margin: 0; font-weight: 300; }
        .subtitle { font-size: 14px; opacity: 0.9; margin-top: 5px; }
        .content { padding: 30px; }
        .status { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
        .debug-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; font-family: 'Courier New', monospace; font-size: 14px; }
        .test-section { margin: 30px 0; }
        .test-btn { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; margin: 8px; font-size: 14px; transition: transform 0.2s; }
        .test-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .result { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff; display: none; }
        .success { border-left-color: #28a745; background: #d4edda; }
        .error { border-left-color: #dc3545; background: #f8d7da; }
        .image-container { text-align: center; margin-top: 15px; }
        .test-image { max-width: 300px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">🎬 TMDB Proxy Service</div>
            <div class="subtitle">EdgeOne Pages - Debug Mode</div>
        </div>
        
        <div class="content">
            <div class="status">
                <strong>✅ Service Status:</strong> Active<br>
                <strong>🔧 Version:</strong> 1.0.3-Ultimate<br>
                <strong>🏷️ Instance ID:</strong> ${instanceId}<br>
                <strong>📊 Request Count:</strong> ${requestCount}<br>
                <strong>⏰ Timestamp:</strong> ${new Date().toISOString()}
            </div>
            
            <div class="debug-info">
                <strong>Debug Information:</strong><br>
                • This version includes enhanced error handling<br>
                • Multiple retry attempts for failed requests<br>
                • Instance tracking to debug EdgeOne issues<br>
                • Detailed logging for troubleshooting<br>
                • Optimized caching strategies
            </div>
            
            <div class="test-section">
                <h3>🧪 Test Functions</h3>
                <button class="test-btn" onclick="testInstance()">测试实例状态</button>
                <button class="test-btn" onclick="testHealth()">测试健康检查</button>
                <button class="test-btn" onclick="testImage()">测试图片代理</button>
                <button class="test-btn" onclick="stressTest()">压力测试 (5次)</button>
                
                <div id="result" class="result"></div>
            </div>
        </div>
    </div>
    
    <script>
        let testCount = 0;
        
        function showResult(content, isSuccess = true) {
            const result = document.getElementById('result');
            result.innerHTML = content;
            result.className = 'result ' + (isSuccess ? 'success' : 'error');
            result.style.display = 'block';
        }
        
        async function testInstance() {
            try {
                const response = await fetch('/instance');
                const data = await response.json();
                showResult('<strong>实例状态:</strong><br><pre>' + JSON.stringify(data, null, 2) + '</pre>');
            } catch (error) {
                showResult('<strong>实例状态测试失败:</strong><br>' + error.message, false);
            }
        }
        
        async function testHealth() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                showResult('<strong>健康检查成功:</strong><br><pre>' + JSON.stringify(data, null, 2) + '</pre>');
            } catch (error) {
                showResult('<strong>健康检查失败:</strong><br>' + error.message, false);
            }
        }
        
        async function testImage() {
            const testUrl = '/t/p/w500/bxmAk4Qf7yf7vMhuev1Vw4nxbLK.jpg';
            try {
                showResult('正在测试图片代理...');
                const response = await fetch(testUrl);
                
                if (response.ok) {
                    const contentType = response.headers.get('Content-Type');
                    const proxyInstance = response.headers.get('X-Proxy-Instance');
                    const proxyAttempt = response.headers.get('X-Proxy-Attempt');
                    
                    showResult(\`<strong>图片代理成功!</strong><br>
                        状态码: \${response.status}<br>
                        类型: \${contentType}<br>
                        代理实例: \${proxyInstance}<br>
                        尝试次数: \${proxyAttempt}<br>
                        <div class="image-container">
                            <img src="\${testUrl}" class="test-image" alt="Test Image" />
                        </div>\`);
                } else {
                    showResult('<strong>图片代理失败</strong><br>状态码: ' + response.status, false);
                }
            } catch (error) {
                showResult('<strong>图片代理失败:</strong><br>' + error.message, false);
            }
        }
        
        async function stressTest() {
            showResult('开始压力测试 (5次连续请求)...');
            const results = [];
            const testUrl = '/t/p/w500/bxmAk4Qf7yf7vMhuev1Vw4nxbLK.jpg';
            
            for (let i = 1; i <= 5; i++) {
                try {
                    const start = Date.now();
                    const response = await fetch(testUrl + '?test=' + i);
                    const duration = Date.now() - start;
                    
                    results.push({
                        test: i,
                        status: response.status,
                        success: response.ok,
                        duration: duration + 'ms',
                        instance: response.headers.get('X-Proxy-Instance'),
                        attempt: response.headers.get('X-Proxy-Attempt')
                    });
                } catch (error) {
                    results.push({
                        test: i,
                        status: 'ERROR',
                        success: false,
                        error: error.message
                    });
                }
                
                // 短暂延迟
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const successCount = results.filter(r => r.success).length;
            const isSuccess = successCount >= 4; // 至少80%成功率
            
            showResult(\`<strong>压力测试完成:</strong><br>
                成功: \${successCount}/5 (\${(successCount/5*100).toFixed(1)}%)<br>
                <pre>\${JSON.stringify(results, null, 2)}</pre>\`, isSuccess);
        }
        
        // 页面加载时的信息
        console.log('🎬 TMDB Proxy Service - EdgeOne Pages Debug Mode');
        console.log('Instance ID: ${instanceId}');
        console.log('Request Count: ${requestCount}');
        console.log('Version: 1.0.3-Ultimate');
        console.log('Timestamp: ${new Date().toISOString()}');
        
        // 定期检查实例状态
        setInterval(async () => {
            try {
                const response = await fetch('/instance');
                const data = await response.json();
                console.log('Instance check:', data);
            } catch (error) {
                console.error('Instance check failed:', error);
            }
        }, 30000); // 每30秒检查一次
    </script>
</body>
</html>`;
}
