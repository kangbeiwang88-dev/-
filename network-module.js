/**
 * 【鲁迅的人情罗网】网络模块
 * 兼容主HTML中 parseNetworkCSV 的输出格式：
 * socialNetworkData = [{id,name,relation,events:[{time,description}, ...]}, ...]
 */

const NETWORK_CONFIG = {
    minYear: 1912,
    maxYear: 1926,
    nodeRadius: { center: 18, person: 11 },
    colors: { primary: '#C9361D', broken: '#CCCCCC' }
};

const relationColors = {
    '亲属': { color: '#B44C43', bg: '#FFE5E5' },
    '同乡': { color: '#4A5D75', bg: '#E5F0FF' },
    '友人': { color: '#5F7156', bg: '#E5FFE8' },
    '同事': { color: '#D9A033', bg: '#FFF8E5' },
    '学生': { color: '#9B5F90', bg: '#F5E5FF' },
    '其他': { color: '#8B7D6B', bg: '#F5F5F5' }
};

let currentSimulation = null;
let networkState = { nodes: [], links: [], allNodes: [], allLinks: [], currentYear: 1926, activeFilters: new Set() };

async function showNetworkGraph(locationName) {
    const modal = document.getElementById('networkModal');
    if (!modal) { console.error('networkModal not found'); return; }
    const title = document.getElementById('networkTitle'); if (title) title.textContent = `${locationName} — 鲁迅的人情罗网`;
    modal.classList.add('show');

    await ensureDataLoaded();
    if (!window.socialNetworkData || window.socialNetworkData.length === 0) {
        d3.select('#network-graph').html('<text x="50%" y="50%" text-anchor="middle" fill="#999">暂无社交关系数据</text>');
        console.info('network-module: no socialNetworkData after attempt to load network-data.json');
        return;
    }

    buildNetworkData();
    renderNetworkControls();
    drawNetworkGraph();
}

function closeNetworkModal() {
    const modal = document.getElementById('networkModal'); if (modal) modal.classList.remove('show');
    const sidebar = document.getElementById('sidebarPersonal'); if (sidebar) sidebar.innerHTML = '<div class="sidebar-empty">点击人物或连线查看详情</div>';
}

function buildNetworkData() {
    const nodes = [
        { id: 'lu_xun', name: '鲁迅', type: 'center', radius: NETWORK_CONFIG.nodeRadius.center, relation: '中心', color: NETWORK_CONFIG.colors.primary, events: [], minYear: NETWORK_CONFIG.minYear }
    ];

    const links = [];
    (window.socialNetworkData || []).forEach((p, i) => {
        const nodeId = `person_${i}`;
        const events = p.events || [];
        let minYear = NETWORK_CONFIG.maxYear;
        events.forEach(ev => { const y = parseInt(ev.time); if (!isNaN(y)) minYear = Math.min(minYear, y); });

        const node = {
            id: nodeId,
            name: p.name,
            type: 'person',
            relation: p.relation,
            radius: NETWORK_CONFIG.nodeRadius.person,
            color: relationColors[p.relation]?.color || relationColors['其他'].color,
            events: events,
            minYear: minYear
        };

        nodes.push(node);

        const isBroken = events.some(ev => (ev.description || '').includes('破裂') || (ev.description || '').includes('断交'));

        links.push({ source: 'lu_xun', target: nodeId, relation: p.relation, events: events, isBroken: isBroken, minYear: minYear });
    });

    networkState.allNodes = nodes;
    networkState.allLinks = links;
    networkState.nodes = nodes.slice();
    networkState.links = links.slice();
    networkState.activeFilters = new Set(Array.from(new Set((window.socialNetworkData || []).map(p => p.relation))));
}

function renderNetworkControls() {
    const controlsDiv = document.getElementById('networkControls'); if (!controlsDiv) return;
    const relations = Array.from(new Set((window.socialNetworkData || []).map(p => p.relation)));
    controlsDiv.innerHTML = `
        <div class="controls-row">
            <div class="filter-box">
                <h4>按关系筛选</h4>
                <div class="filter-buttons" id="relationFilters"></div>
            </div>
            <div class="timeline-box">
                <h4>时间线：<span class="year-label" id="yearLabel">${networkState.currentYear}年</span></h4>
                <input type="range" class="year-slider" id="yearSlider" min="${NETWORK_CONFIG.minYear}" max="${NETWORK_CONFIG.maxYear}" value="${networkState.currentYear}">
            </div>
        </div>`;

    const container = document.getElementById('relationFilters');
    relations.forEach(r => {
        const b = document.createElement('button');
        b.className = 'filter-btn active';
        b.textContent = r;
        b.dataset.relation = r;
        b.onclick = () => toggleRelationFilter(r, b);
        container.appendChild(b);
    });

    const slider = document.getElementById('yearSlider');
    if (slider) slider.oninput = (e) => { networkState.currentYear = parseInt(e.target.value); const label = document.getElementById('yearLabel'); if (label) label.textContent = `${networkState.currentYear}年`; applyNetworkFilters(); };
}

function toggleRelationFilter(relation, btn) {
    if (networkState.activeFilters.has(relation)) { networkState.activeFilters.delete(relation); btn.classList.remove('active'); } else { networkState.activeFilters.add(relation); btn.classList.add('active'); }
    applyNetworkFilters();
}

function applyNetworkFilters() {
    const year = networkState.currentYear;
    let filteredNodes = networkState.allNodes.filter(n => n.type === 'center' || n.minYear <= year);
    filteredNodes = filteredNodes.filter(n => n.type === 'center' || networkState.activeFilters.has(n.relation));

    const filteredLinks = networkState.allLinks.filter(l => {
        const srcExists = filteredNodes.some(n => n.id === l.source || (typeof l.source === 'object' && n.id === l.source.id));
        const tgtExists = filteredNodes.some(n => n.id === l.target || (typeof l.target === 'object' && n.id === l.target.id));
        return srcExists && tgtExists && l.minYear <= year;
    });

    networkState.nodes = filteredNodes;
    networkState.links = filteredLinks;
    drawNetworkGraph();
}

function drawNetworkGraph() {
    const svg = d3.select('#network-graph');
    const container = document.getElementById('network-graph');
    if (!container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    console.time('drawNetworkGraph');
    console.info('drawNetworkGraph: nodes=', networkState.nodes.length, 'links=', networkState.links.length);
    const simulation = d3.forceSimulation(networkState.nodes)
        .force('link', d3.forceLink(networkState.links).id(d => d.id).distance(d => (d.relation === '亲属' ? 60 : 120)))
        .force('charge', d3.forceManyBody().strength(-80))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => (d.radius || 10) + 18))
        .velocityDecay(0.6)
        .alphaDecay(0.06);

    currentSimulation = simulation;

    // 快速预热若干步以获得稳定初始布局，随后停止以减少空转开销。
    // 对于几十到几百个节点，这通常能显著提升响应性。
    try {
        simulation.alpha(1);
        for (let i = 0; i < 120; i++) simulation.tick();
        simulation.stop();
    } catch (e) {
        console.warn('simulation pre-tick skipped:', e);
    }

    const link = svg.append('g').attr('class', 'links').selectAll('line').data(networkState.links).enter().append('line')
        .attr('class', d => d.isBroken ? 'link broken' : 'link')
        .attr('stroke', d => d.isBroken ? NETWORK_CONFIG.colors.broken : (relationColors[d.relation]?.color || '#999'))
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', d => d.isBroken ? '4,4' : '0')
        .attr('stroke-opacity', 0.8)
        .on('mouseover', function (event, d) {
            d3.select(this).attr('stroke-width', 4).attr('stroke-opacity', 1);
            const src = typeof d.source === 'object' ? d.source.id : d.source;
            const tgt = typeof d.target === 'object' ? d.target.id : d.target;
            d3.selectAll('.node').style('opacity', n => (n.id === src || n.id === tgt) ? 1 : 0.2);
        })
        .on('mouseout', function () {
            d3.select(this).attr('stroke-width', 2).attr('stroke-opacity', 0.8);
            d3.selectAll('.node').style('opacity', 1);
        })
        .on('click', function (event, d) { event.stopPropagation(); showSidebarForLink(d); });

    const node = svg.append('g').attr('class', 'nodes').selectAll('g').data(networkState.nodes).enter().append('g')
        .attr('class', 'node')
        .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))
        .on('click', function (event, d) { event.stopPropagation(); showSidebarForNode(d); })
        .on('mouseover', function () { d3.select(this).select('circle').attr('r', d => (d.radius || 10) * 1.3); })
        .on('mouseout', function () { d3.select(this).select('circle').attr('r', d => d.radius || 10); });

    node.append('circle').attr('r', d => d.radius || 10).attr('fill', d => d.color || '#8B7D6B').attr('stroke', '#F5F1E8').attr('stroke-width', 2);
    node.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', d => d.type === 'center' ? '12px' : '11px').attr('fill', '#fff').attr('pointer-events', 'none').text(d => d.name);

    simulation.on('tick', () => {
        link.attr('x1', d => (typeof d.source === 'object' ? d.source.x : d.source.x))
            .attr('y1', d => (typeof d.source === 'object' ? d.source.y : d.source.y))
            .attr('x2', d => (typeof d.target === 'object' ? d.target.x : d.target.x))
            .attr('y2', d => (typeof d.target === 'object' ? d.target.y : d.target.y));

        node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });
    console.timeEnd('drawNetworkGraph');
}

async function ensureDataLoaded() {
    if (window.socialNetworkData && Array.isArray(window.socialNetworkData) && window.socialNetworkData.length > 0) return;
    try {
        console.info('network-module: loading network-data.json...');
        const resp = await fetch('./network-data.json');
        if (!resp.ok) { console.warn('network-module: failed to fetch network-data.json', resp.status); return; }
        const jd = await resp.json();
        // Convert nodes/links format to socialNetworkData array expected by module
        if (jd && Array.isArray(jd.nodes)) {
            const persons = jd.nodes.filter(n => n.type === 'person').map(n => ({ name: n.name, relation: n.relation, events: n.events || [] }));
            window.socialNetworkData = persons;
            console.info('network-module: loaded socialNetworkData from network-data.json, persons=', persons.length);
        } else {
            console.warn('network-module: network-data.json format unexpected');
        }
    } catch (e) {
        console.error('network-module: error loading network-data.json', e);
    }
}

function dragstarted(event, d) { if (!event.active && currentSimulation) currentSimulation.alphaTarget(0.3).restart(); d.fx = event.x; d.fy = event.y; }
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragended(event, d) { if (!event.active && currentSimulation) currentSimulation.alphaTarget(0); d.fx = null; d.fy = null; }

function showSidebarForNode(node) {
    const sidebar = document.getElementById('sidebarPersonal'); if (!sidebar) return;
    let html = `<div class="sidebar-title">${node.name}</div>`;
    html += `<div class="sidebar-meta"><p><strong>与鲁迅的关系：</strong> <span style="color: ${node.color};">● ${node.relation}</span></p></div>`;
    if (node.events && node.events.length > 0) {
        html += '<div class="sidebar-section"><h4>📅 重要事件</h4>';
        node.events.forEach(e => { html += `<div class="event-record"><div class="event-time">${e.time}</div><div class="event-desc">${e.description || ''}</div></div>`; });
        html += '</div>';
    }
    sidebar.innerHTML = html;
}

function showSidebarForLink(link) {
    const sidebar = document.getElementById('sidebarPersonal'); if (!sidebar) return;
    const srcName = typeof link.source === 'object' ? link.source.name : link.source;
    const tgtName = typeof link.target === 'object' ? link.target.name : link.target;
    let html = `<div class="sidebar-title">${link.relation}${link.isBroken ? '（已断裂）' : ''}关系</div>`;
    html += `<div class="sidebar-meta"><p><strong>人物：</strong> ${srcName} ↔ ${tgtName}</p></div>`;
    if (link.events && link.events.length > 0) {
        html += '<div class="sidebar-section"><h4>📜 关系演变</h4>';
        link.events.forEach(e => { html += `<div class="event-record"><div class="event-time">${e.time}</div><div class="event-desc">${e.description || ''}</div></div>`; });
        html += '</div>';
    }
    sidebar.innerHTML = html;
}

window.showNetworkGraph = showNetworkGraph;
window.closeNetworkModal = closeNetworkModal;
