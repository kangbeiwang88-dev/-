# AI 代码助手指导文档

## 项目概述

**项目名称**: 鲁迅在北京 - 1920年代交互式地图应用

这是一个基于 Leaflet.js 的单页面 Web 应用，展示鲁迅在北京（1912-1926年）活动的历史地点。包含92条地点记录，支持搜索、分类筛选、地点详情展示等交互功能。

## 关键架构模式

### 1. **单文件应用架构**
- 整个应用集成在 `主图.html` 一个文件中（1728行）
- HTML + CSS + JavaScript（ES6+）混合结构
- 不使用前端框架（原生 DOM 操作）
- **关键模式**：使用全局变量存储应用状态（map, locationData, markers, currentFilter）

### 2. **数据流设计**
```
CSV文件 → parseCSV() → locationData数组 → 地图标记 + 侧边栏列表
         ↓
    CSV加载策略（HTTP优先 → FileReader → 示例备用数据）
```

**核心处理**:
- `loadCSV()` 方法：多策略加载 CSV（处理 CORS 限制）
- `parseCSV()` 方法：自定义CSV解析器（处理中文编码、复杂字段）
- `getCSVDataFallback()` 方法：内置92条示例数据（所有记录完整备份）

### 3. **Leaflet.js 地图配置**
- **关键特性**：使用自定义CRS (L.CRS.Simple) 将历史地图图片作为基础层
- **图片路径**: `map_pekin1920_full.jpg` (1920年代北京地图，宽×高约 5000×6000)
- **坐标系**：自定义像素坐标而非地理坐标
- **缩放范围**：minZoom=-3，maxZoom=3

## 关键开发约定

### 1. **中文编码与国际化**
- HTML 必须指定 `charset="UTF-8"`
- 字体栈优先使用中文字体：`'Microsoft YaHei', '微软雅黑', 'SimSun', '宋体'`
- CSS 使用 `-webkit-font-smoothing: antialiased` 优化中文渲染
- **CSV 数据**：必须 UTF-8 编码，格式行为：`id,name,Y,X,category,address,zoom,short_text,full_text,images,audio,route_ids,source`

### 2. **坐标系统**
- **Y** = 垂直坐标（行），**X** = 水平坐标（列）
- 数据 CSV 中坐标直接对应图片像素位置
- 标记点创建：`L.circleMarker([Y, X], options)`

### 3. **颜色编码与分类**
11个固定分类，每个有独特颜色（保存在 `CATEGORY_COLORS` 对象）：
```javascript
'居住地': '#e74c3c' (红),  '工作地': '#3498db' (蓝),
'教书地': '#2ecc71' (绿),  '餐饮地': '#f39c12' (橙),
// ... 共11个
```
**规则**：修改分类时需同时更新此对象和后端数据

### 4. **交互逻辑**
- **搜索**：实时过滤（input 事件触发 `filterLocations()`）
- **分类筛选**：点击分类标题切换 active 状态，更新 `currentFilter`
- **侧边栏折叠**：通过 toggle 按钮控制 `.collapsed` 样式class
- **模态框**：点击标记或列表项触发，ESC 键关闭

## 部署与运行

### 必须使用 HTTP 服务器
**原因**：浏览器安全限制禁止 file:// 协议访问本地 CSV 文件（CORS 错误）

**启动方式**：
1. **Windows批处理**：双击 `start_server.bat`（推荐）
2. **Python 命令**：`python -m http.server 8080`
3. **访问地址**：`http://localhost:8080/主图.html`

**故障排查**：
- 若服务器加载失败，应用自动降级到内置示例数据
- `地点数据_数据库格式.csv` 必须与 HTML 同目录
- 地图图片文件自动寻找 `map_pekin1920_full.jpg` 或 `gigapixel-map_pekin1920_full.jpg`

## 常见修改点

### 添加新的历史地点
1. 在 `getCSVDataFallback()` 中追加对象到数组（保持格式一致）
2. 或修改 CSV 文件（严格遵守 UTF-8 编码和逗号分隔）
3. 确保 **Y、X 坐标有效**（数字字符串，且 ≥0）

### 修改分类
1. 更新 `CATEGORY_COLORS` 对象（添加/删除键值对）
2. 修改 CSV 中的 `category` 字段
3. 侧边栏会自动根据 `categoryMenu` 容器动态生成分类按钮

### 自定义样式
- **CSS**: 直接在 `<style>` 块中修改（第13-570行）
- **响应式**：三个断点 768px、480px、320px
- **暗色模式**：背景梯度色定义在 body，可修改

## 文件关键行号参考

| 功能 | 位置 |
|-----|------|
| 全局变量声明 | 625-627 |
| 分类颜色配置 | 631-643 |
| CSV 解析函数 | 646-700 |
| 地图初始化 | 1100-1150 |
| UI 交互绑定 | 1160-1200 |
| 侧边栏渲染 | 1300-1400 |
| 标记点创建 | 1450-1500 |

## 性能考虑

- **数据量**：92个地点可全部加载到内存（无分页需求）
- **搜索**：使用 `String.includes()` 简单字符串匹配，已足够高效
- **地图**：Leaflet 自动处理图片平铺，缩放流畅
- **内存占用**：markers 数组存储所有标记对象（不释放，可优化）

## 外部依赖

- **Leaflet 1.9.4** (CDN): 地图库
- **无其他依赖**（不使用 jQuery、React 等）

---

**最后更新**: 2025年12月14日  
**适用版本**: 基于单文件版本 (主图.html - 1728行)
