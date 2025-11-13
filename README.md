# TMDB Proxy - EdgeOne Pages 版本

基于成功的 [eo-pages-func-reverse-proxy](https://github.com/xrgzs/eo-pages-func-reverse-proxy) 项目模板创建的TMDB代理服务。

## 🚀 部署步骤

### 方法1: GitHub仓库部署（推荐）

1. **Fork或创建仓库**
   - 将此文件夹内容上传到GitHub仓库
   - 确保文件结构：
     ```
     your-repo/
     ├── functions/
     │   └── [[default]].ts
     └── edgeone.json
     ```

2. **EdgeOne Pages部署**
   - 登录 [EdgeOne控制台](https://console.cloud.tencent.com/edgeone)
   - 进入 Pages 服务
   - 点击"新建站点"
   - 选择"连接Git仓库"
   - 选择你的GitHub仓库
   - 点击"部署"

### 方法2: 直接上传

1. **打包文件**
   - 将 `functions` 文件夹和 `edgeone.json` 一起打包成zip

2. **上传部署**
   - EdgeOne控制台 → Pages → 上传文件
   - 选择zip文件并部署

## 📁 文件说明

- `functions/[[default]].ts` - 主要的代理逻辑文件
- `edgeone.json` - EdgeOne配置文件（缓存策略）

## 🎯 使用方法

### 图片代理
```bash
# 原始TMDB图片
https://image.tmdb.org/t/p/w500/bcP7FtskwsNp1ikpMQJzDPjofP5.jpg

# 通过代理访问
https://your-edgeone-domain.com/t/p/w500/bcP7FtskwsNp1ikpMQJzDPjofP5.jpg
```

### API代理
```bash
# 需要提供API Key
curl -H "X-API-Key: your_tmdb_api_key" https://your-edgeone-domain.com/3/movie/popular

# 或使用URL参数
https://your-edgeone-domain.com/3/movie/popular?api_key=your_tmdb_api_key
```

### JavaScript调用
```javascript
// 图片使用
<img src="https://your-edgeone-domain.com/t/p/w500/poster.jpg" />

// API调用
fetch('https://your-edgeone-domain.com/3/movie/popular', {
  headers: { 'X-API-Key': 'your_tmdb_api_key' }
})
.then(res => res.json())
.then(data => console.log(data));
```

## 🔧 管理端点

### 健康检查
```bash
curl https://your-edgeone-domain.com/health
```

### 服务状态（需要API Key）
```bash
curl -H "X-API-Key: your_tmdb_api_key" https://your-edgeone-domain.com/admin/status
```

## ⚡ 功能特性

- ✅ **完全兼容**: 基于成功的EdgeOne项目模板
- ✅ **完美伪装**: 主页显示404错误页面
- ✅ **智能缓存**: 图片7天，API根据类型缓存
- ✅ **CORS支持**: 完美的跨域访问支持
- ✅ **安全防护**: API Key保护和错误隐藏
- ✅ **TypeScript**: 完整的类型支持
- ✅ **全球CDN**: EdgeOne全球节点加速

## 📊 缓存策略

| 路径 | 缓存时间 | 说明 |
|------|---------|------|
| `/t/p/*` | 7天 | 图片资源长期缓存 |
| `/3/configuration*` | 1小时 | 配置信息 |
| `/3/search*` | 5分钟 | 搜索结果 |
| `/3/movie/popular*` | 30分钟 | 热门内容 |
| `/3/*` | 10分钟 | 其他API |

## 🛡️ 安全特性

- 🔒 **API Key保护**: API请求需要提供有效的TMDB API Key
- 🎭 **404伪装**: 主页和错误都伪装成404页面
- 🌍 **地理信息**: 利用EdgeOne的详细地理位置数据
- 🔍 **错误隐藏**: 不暴露内部错误信息

## 🎉 部署成功后

访问你的EdgeOne域名，你将看到：
- 主页显示404页面（正常，这是伪装）
- 按F12打开控制台可以看到服务信息
- 图片和API代理功能正常工作

## 📝 注意事项

1. **API Key必须**: API请求必须提供有效的TMDB API Key
2. **404是正常的**: 主页显示404是安全伪装，不是错误
3. **控制台信息**: 真正的服务信息在浏览器控制台中
4. **缓存生效**: 首次访问后，后续访问会更快（缓存生效）

现在你有了一个完全基于成功模板的TMDB代理服务！
