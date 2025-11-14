# TMDB Proxy - Cloudflare Workers 版本 AI杰作

部署好绑定自己域名后
记得在路径 MOVIEPILOT v2 设定-系统-高级设置-添加上去 xx.org  与网络-安全域名里面 也需要添加上去保存-保存-重启MP应用

<img width="1399" height="354" alt="image" src="https://github.com/user-attachments/assets/283f5dc8-b977-4597-bc9f-6a8abb01cdfa" />


🎬 基于 Cloudflare Workers 的 TMDB (The Movie Database) 代理服务，提供图片和 API 代理功能，具备安全伪装、智能缓存和全球 CDN 加速。

## ✨ 功能特性

- 🔒 **安全伪装**: 主页显示 404 页面，隐藏真实服务
- 🖼️ **图片代理**: 支持 WebP/AVIF 格式，7天缓存
- 🔌 **API 代理**: 智能缓存策略，5分钟到1小时不等
- 🌍 **全球 CDN**: Cloudflare 全球节点加速
- 🛡️ **安全防护**: API Key 保护，恶意爬虫检测
- 📊 **性能优化**: 图片压缩、自适应加载
- 🔍 **监控端点**: 健康检查和管理接口

## 🚀 快速部署

### 方法1: Cloudflare Workers Dashboard

1. **登录 Cloudflare Dashboard**
   - 访问 [Cloudflare Workers](https://workers.cloudflare.com/)
   - 登录你的 Cloudflare 账户

2. **创建新的 Worker**
   - 点击 "Create a Service"
   - 输入服务名称（如：`tmdb-proxy`）
   - 选择 "HTTP handler" 模板

3. **部署代码**
   - 将 `worker.js` 的内容复制到编辑器中
   - 点击 "Save and Deploy"

### 方法2: Wrangler CLI

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建新项目
wrangler init tmdb-proxy

# 复制 worker.js 内容到 src/index.js
# 部署到 Cloudflare Workers
wrangler deploy
```

### 方法3: 一键部署

**注意**: 使用一键部署前，请确保你的 GitHub 仓库包含以下文件：
- `worker.js` - 主要代码文件
- `wrangler.toml` - Wrangler 配置文件
- `package.json` - 项目配置文件

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/qqcomeup/cf-tmdb)

如果遇到 "找不到 wrangler.toml 文件" 的错误，请先将本项目的所有文件上传到你的 GitHub 仓库。

## 📖 使用方法

### 图片代理

```javascript
// 原始 TMDB 图片
https://image.tmdb.org/t/p/w500/poster.jpg

// 通过代理访问
https://your-worker.your-subdomain.workers.dev/t/p/w500/poster.jpg
```

### API 代理

需要提供有效的 TMDB API Key：

```javascript
// 方法1: 使用 Header
fetch('https://your-worker.your-subdomain.workers.dev/3/movie/popular', {
  headers: {
    'X-API-Key': 'your_tmdb_api_key'
  }
})

// 方法2: 使用 URL 参数
https://your-worker.your-subdomain.workers.dev/3/movie/popular?api_key=your_tmdb_api_key

// 方法3: 使用简短参数
https://your-worker.your-subdomain.workers.dev/3/movie/popular?key=your_tmdb_api_key
```

### JavaScript 示例

```javascript
// 图片使用
const imageUrl = 'https://your-worker.your-subdomain.workers.dev/t/p/w500/poster.jpg';
document.getElementById('poster').src = imageUrl;

// API 调用
async function getPopularMovies() {
  try {
    const response = await fetch('https://your-worker.your-subdomain.workers.dev/3/movie/popular', {
      headers: {
        'X-API-Key': 'your_tmdb_api_key'
      }
    });
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## 🔧 管理端点

### 健康检查

```bash
# 基础健康检查（无需 API Key）
curl https://your-worker.your-subdomain.workers.dev/health

# 或者
curl https://your-worker.your-subdomain.workers.dev/ping
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": "active"
}
```

### 服务状态（需要 API Key）

```bash
curl -H "X-API-Key: your_tmdb_api_key" \
     https://your-worker.your-subdomain.workers.dev/admin/status
```

响应示例：
```json
{
  "status": "active",
  "version": "2.0.0",
  "endpoints": {
    "images": "/t/p/{size}/{path}",
    "api": "/3/{endpoint}"
  },
  "client_info": {
    "ip": "1.2.3.4",
    "country": "US",
    "ua": "Mozilla/5.0..."
  },
  "security": {
    "api_key_provided": true,
    "request_secure": true
  },
  "performance": {
    "cache_enabled": true,
    "compression": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📊 缓存策略

| 端点类型 | 缓存时间 | 说明 |
|---------|---------|------|
| 图片 (`/t/p/*`) | 7天 | 强缓存，支持 ETag |
| 配置 (`/3/configuration*`) | 1小时 | 配置信息变化较少 |
| 搜索 (`/3/search*`) | 5分钟 | 搜索结果实时性要求高 |
| 热门 (`/3/movie/popular*`) | 30分钟 | 热门内容更新频率中等 |
| 其他 API (`/3/*`) | 10分钟 | 默认缓存时间 |

## 🛡️ 安全特性

### API Key 保护
- 支持多种 API Key 传递方式
- 自动验证 API Key 格式（32位字符）
- 无效请求返回伪装 404 页面

### 恶意爬虫检测
```javascript
// 检测的 User-Agent 关键词
['curl', 'wget', 'python', 'scrapy', 'spider']

// 允许的搜索引擎爬虫
['googlebot'] // Google 爬虫除外
```

### 地理位置控制
```javascript
// 可配置屏蔽的国家/地区
const blockedCountries = []; // 在代码中自定义
```

### 404 伪装页面
- 主页和错误请求都显示逼真的 404 页面
- 开发者控制台显示真实服务信息
- 提供隐藏的测试函数

## 🎯 测试方法

部署成功后，打开浏览器开发者控制台进行测试：

```javascript
// 在浏览器控制台中运行

// 测试 API（需要先设置 API Key）
testAPI()

// 测试图片加载
testImage()
```

或使用 curl 命令：

```bash
# 1. 健康检查
curl https://your-worker.your-subdomain.workers.dev/health

# 2. 图片代理测试
curl -I https://your-worker.your-subdomain.workers.dev/t/p/w500/bcP7FtskwsNp1ikpMQJzDPjofP5.jpg

# 3. API 代理测试（需要 API Key）
curl -H "X-API-Key: your_api_key" \
     https://your-worker.your-subdomain.workers.dev/3/configuration

# 4. 主页测试（应该显示 404）
curl https://your-worker.your-subdomain.workers.dev/
```

## 📝 配置说明

### 获取 TMDB API Key

1. 访问 [TMDB 官网](https://www.themoviedb.org/)
2. 注册账户并登录
3. 进入 [API 设置页面](https://www.themoviedb.org/settings/api)
4. 申请 API Key（通常几分钟内批准）

### 自定义域名（可选）

1. 在 Cloudflare Workers 中添加自定义域名
2. 配置 DNS 记录指向 Workers
3. 启用 SSL/TLS 加密

## 🔍 故障排除

### 常见问题

**Q: 主页显示 404 是正常的吗？**
A: 是的，这是安全伪装功能。真实的服务信息在浏览器开发者控制台中。

**Q: API 请求返回 404**
A: 检查是否提供了有效的 TMDB API Key，支持 Header 和 URL 参数两种方式。

**Q: 图片加载失败**
A: 确认图片路径正确，TMDB 图片路径格式为 `/t/p/{size}/{file_path}`。

**Q: 如何查看详细错误信息？**
A: 在 Cloudflare Workers Dashboard 中查看实时日志。

### 性能优化建议

1. **启用 Cloudflare 缓存**: 在 Workers 设置中启用缓存
2. **使用 WebP 格式**: 现代浏览器自动获得 WebP 格式图片
3. **合理设置缓存**: 根据数据更新频率调整缓存时间
4. **监控使用量**: 关注 Workers 的请求量和响应时间

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交Pull Request！

## 📞 支持

- GitHub Issues: [提交问题](https://github.com/qqcomeup/cf-tmdb/issues)
- TMDB API 文档: [官方文档](https://developers.themoviedb.org/3)
- Cloudflare Workers 文档: [官方文档](https://developers.cloudflare.com/workers/)

---

⭐ 如果这个项目对你有帮助，请给个 Star！
