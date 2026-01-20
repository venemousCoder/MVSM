/**
 * SERVICE SCRIPT BUILDER
 * Phase 3.1: Foundation - Canvas and Static Nodes
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE ---
    const state = {
        scale: 1,
        panX: 0,
        panY: 0,
        isPanning: false,
        lastMouseX: 0,
        lastMouseY: 0,
        nodes: [],
        connections: [],
        selectedNodeId: null,
        nextId: 1,
        draggedNodeType: null,
        isConnecting: false,
        tempConnectionStart: null
    };

    // --- DOM ELEMENTS ---
    const canvasContainer = document.getElementById('canvas-container');
    const canvasLayer = document.getElementById('canvas-layer');
    const connectionsLayer = document.getElementById('connections-layer');
    const zoomLevelEl = document.getElementById('zoom-level');
    const inspectorContent = document.getElementById('inspector-content');

    // --- INITIALIZATION ---
    function init() {
        setupCanvasEvents();
        setupDragDrop();
        setupToolbar();
        
        // Initial Center
        centerCanvas();
    }

    function centerCanvas() {
        const rect = canvasContainer.getBoundingClientRect();
        state.panX = rect.width / 2;
        state.panY = rect.height / 2;
        updateCanvasTransform();
    }

    // --- CANVAS NAVIGATION ---
    function setupCanvasEvents() {
        // Panning
        canvasContainer.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.target === canvasContainer)) { // Middle mouse or left on bg
                state.isPanning = true;
                state.lastMouseX = e.clientX;
                state.lastMouseY = e.clientY;
                canvasContainer.style.cursor = 'grabbing';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (state.isPanning) {
                const deltaX = e.clientX - state.lastMouseX;
                const deltaY = e.clientY - state.lastMouseY;
                
                state.panX += deltaX;
                state.panY += deltaY;
                
                state.lastMouseX = e.clientX;
                state.lastMouseY = e.clientY;
                
                updateCanvasTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            state.isPanning = false;
            canvasContainer.style.cursor = 'default';
        });

        // Zooming
        canvasContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSensitivity = 0.1;
            const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
            const newScale = Math.max(0.1, Math.min(5, state.scale + delta));
            
            // Zoom towards mouse pointer logic (simplified for now: zoom center)
            state.scale = newScale;
            updateCanvasTransform();
        });
    }

    function updateCanvasTransform() {
        canvasLayer.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
        zoomLevelEl.innerText = `${Math.round(state.scale * 100)}%`;
    }

    // --- NODE SYSTEM ---
    
    function createNode(type, x, y, data = {}) {
        const id = `node_${state.nextId++}`;
        
        let inputs = [];
        let outputs = [];

        // Default data and ports based on type
        if (type === 'question') {
            data = {
                question_text: data.question_text || "New Question",
                input_type: data.input_type || "multiple_choice",
                answer_options: data.answer_options || ["Option 1", "Option 2"]
            };
            inputs = [{ id: 'in_flow', label: 'In', type: 'flow' }];
            // Outputs depend on data, calculated during render or here
            // We'll let render handle visual ports, but logical ports should track data
        } else if (type === 'start') {
            outputs = [{ id: 'out_start', label: 'Start', type: 'flow' }];
        }

        const nodeData = {
            id,
            type,
            x,
            y,
            data: data || {},
            inputs,
            outputs 
        };
        
        state.nodes.push(nodeData);
        renderNode(nodeData);
        selectNode(id);
    }

    function renderNode(nodeData) {
        // Remove existing if present (re-render)
        const existing = document.getElementById(nodeData.id);
        if (existing) existing.remove();

        const el = document.createElement('div');
        el.className = 'flow-node';
        el.id = nodeData.id;
        el.setAttribute('data-type', nodeData.type);
        el.style.left = `${nodeData.x}px`;
        el.style.top = `${nodeData.y}px`;

        // Render Content based on Type
        if (nodeData.type === 'question') {
            renderQuestionNodeContent(el, nodeData);
        } else if (nodeData.type === 'start') {
            renderStartNodeContent(el, nodeData);
        } else {
            renderGenericNodeContent(el, nodeData);
        }

        // Add Input Port (if any)
        if (nodeData.inputs && nodeData.inputs.length > 0) {
            const inputPort = createPortElement(nodeData.id, nodeData.inputs[0], 'input');
            inputPort.style.top = '50%'; // Center vertically relative to a specific handle area if we had one
            inputPort.style.top = '40px'; // Approx below header
            // Better: Append to specific container in content
            // For now, absolute positioning or appending to header
             el.appendChild(inputPort);
        }

        // Drag Logic
        makeDraggable(el, nodeData);
        
        // Select Logic
        el.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            selectNode(nodeData.id);
        });

        canvasLayer.appendChild(el);
        
        // Update connections just in case
        updateConnectionsForNode(nodeData.id);
    }

    function renderStartNodeContent(el, nodeData) {
        el.classList.add('node-start');
        const header = document.createElement('div');
        header.className = 'node-header';
        header.innerHTML = `<span><i class="fas fa-play-circle text-success"></i> Start Flow</span>`;
        el.appendChild(header);

        // Output Port
        const port = createPortElement(nodeData.id, nodeData.outputs[0], 'output');
        port.style.position = 'absolute';
        port.style.right = '-8px';
        port.style.top = '50%';
        el.appendChild(port);
    }

    function renderQuestionNodeContent(el, nodeData) {
        el.classList.add('node-question');

        // Header
        const header = document.createElement('div');
        header.className = 'node-header';
        header.innerHTML = `<span><i class="fas fa-question-circle"></i> ${nodeData.data.question_text}</span>`;
        el.appendChild(header);
        
        // Input Port (Visual adjustment)
        // We'll rely on generic `renderNode` adding it, or add here if we want specific placement
        const inputPort = createPortElement(nodeData.id, { id: 'in_flow', label: 'In' }, 'input');
        inputPort.style.position = 'absolute';
        inputPort.style.left = '-8px';
        inputPort.style.top = '20px'; // On header
        el.appendChild(inputPort);

        // Body
        const body = document.createElement('div');
        body.className = 'node-body';
        
        // Input Type Badge
        const badge = document.createElement('div');
        badge.className = 'badge bg-secondary mb-2';
        badge.innerText = formatInputType(nodeData.data.input_type);
        body.appendChild(badge);

        // Options / Outputs
        const list = document.createElement('ul');
        list.className = 'list-group list-group-flush small';

        const type = nodeData.data.input_type;

        if (type === 'multiple_choice') {
            (nodeData.data.answer_options || []).forEach((opt, idx) => {
                const li = document.createElement('li');
                li.className = 'list-group-item py-1 px-2 d-flex justify-content-between align-items-center position-relative';
                li.innerText = opt;
                
                // Port
                const portId = `out_opt_${idx}`;
                const port = createPortElement(nodeData.id, { id: portId, label: '' }, 'output');
                li.appendChild(port);
                
                list.appendChild(li);
            });
        } else if (type === 'yes_no') {
            ['Yes', 'No'].forEach(opt => {
                const li = document.createElement('li');
                li.className = 'list-group-item py-1 px-2 d-flex justify-content-between align-items-center position-relative';
                li.innerText = opt;
                
                const portId = `out_${opt.toLowerCase()}`;
                const port = createPortElement(nodeData.id, { id: portId, label: '' }, 'output');
                li.appendChild(port);
                
                list.appendChild(li);
            });
        } else {
            // Number, File Upload -> Single Output
            const li = document.createElement('li');
            li.className = 'list-group-item py-1 px-2 d-flex justify-content-between align-items-center position-relative';
            li.innerText = "Next Step";
            
            const port = createPortElement(nodeData.id, { id: 'out_next', label: '' }, 'output');
            li.appendChild(port);
            
            list.appendChild(li);
        }

        body.appendChild(list);
        el.appendChild(body);
    }

    function renderGenericNodeContent(el, nodeData) {
        const header = document.createElement('div');
        header.className = 'node-header';
        header.innerHTML = `<span>${formatLabel(nodeData.type)}</span>`;
        el.appendChild(header);
    }

    function createPortElement(nodeId, portData, direction) {
        const port = document.createElement('div');
        port.className = `port ${direction}`;
        port.dataset.node = nodeId;
        port.dataset.port = portData.id;

        const handle = document.createElement('div');
        handle.className = 'port-handle';
        
        // Connection Logic
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (direction === 'output') {
                startConnection(nodeId, portData.id, e);
            }
        });

        // Drop Logic (Connect)
        handle.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            if (state.isConnecting && direction === 'input') {
                completeConnection(nodeId, portData.id);
            }
        });

        port.appendChild(handle);
        return port;
    }

    function makeDraggable(el, nodeData) {
        let isDragging = false;
        let startX, startY;

        const header = el.querySelector('.node-header');
        
        header.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            el.style.zIndex = 1000;
            canvasContainer.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = (e.clientX - startX) / state.scale;
            const dy = (e.clientY - startY) / state.scale;

            nodeData.x += dx;
            nodeData.y += dy;

            el.style.left = `${nodeData.x}px`;
            el.style.top = `${nodeData.y}px`;

            startX = e.clientX;
            startY = e.clientY;
            
            updateConnectionsForNode(nodeData.id);
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                el.style.zIndex = '';
                canvasContainer.style.cursor = 'default';
            }
        });
    }

    // --- CONNECTIONS ---

    function startConnection(nodeId, portId, e) {
        state.isConnecting = true;
        state.tempConnectionStart = { nodeId, portId, x: 0, y: 0 };
        
        const portEl = document.querySelector(`.port[data-node="${nodeId}"][data-port="${portId}"] .port-handle`);
        const rect = portEl.getBoundingClientRect();
        const canvasRect = canvasLayer.getBoundingClientRect();
        
        state.tempConnectionStart.x = (rect.left + rect.width/2 - canvasRect.left) / state.scale;
        state.tempConnectionStart.y = (rect.top + rect.height/2 - canvasRect.top) / state.scale;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-path');
        path.setAttribute('id', 'temp-connection');
        path.setAttribute('d', ''); 
        connectionsLayer.appendChild(path);
        
        window.addEventListener('mousemove', updateTempConnection);
        window.addEventListener('mouseup', endConnectionDrag);
    }

    function updateTempConnection(e) {
        if (!state.tempConnectionStart) return;

        const canvasRect = canvasLayer.getBoundingClientRect();
        const mouseX = (e.clientX - canvasRect.left) / state.scale;
        const mouseY = (e.clientY - canvasRect.top) / state.scale;

        const d = getBezierPath(state.tempConnectionStart.x, state.tempConnectionStart.y, mouseX, mouseY);
        const path = document.getElementById('temp-connection');
        if (path) path.setAttribute('d', d);
    }
    
    function endConnectionDrag() {
        if (state.isConnecting) {
             cancelConnection();
        }
        window.removeEventListener('mousemove', updateTempConnection);
        window.removeEventListener('mouseup', endConnectionDrag);
    }

    function completeConnection(targetNodeId, targetPortId) {
        if (!state.tempConnectionStart) return;

        if (state.tempConnectionStart.nodeId === targetNodeId) {
            cancelConnection();
            return;
        }

        state.connections.push({
            source: state.tempConnectionStart.nodeId,
            sourcePort: state.tempConnectionStart.portId,
            target: targetNodeId,
            targetPort: targetPortId
        });

        renderConnections();
        cancelConnection(); 
    }

    function cancelConnection() {
        state.isConnecting = false;
        state.tempConnectionStart = null;
        const temp = document.getElementById('temp-connection');
        if (temp) temp.remove();
    }

    function renderConnections() {
        connectionsLayer.innerHTML = '';
        
        state.connections.forEach(conn => {
            const sourceEl = document.querySelector(`.port[data-node="${conn.source}"][data-port="${conn.sourcePort}"] .port-handle`);
            const targetEl = document.querySelector(`.port[data-node="${conn.target}"][data-port="${conn.targetPort}"] .port-handle`);

            if (sourceEl && targetEl) {
                const canvasRect = canvasLayer.getBoundingClientRect();
                const sRect = sourceEl.getBoundingClientRect();
                const tRect = targetEl.getBoundingClientRect();

                const x1 = (sRect.left + sRect.width/2 - canvasRect.left) / state.scale;
                const y1 = (sRect.top + sRect.height/2 - canvasRect.top) / state.scale;
                const x2 = (tRect.left + tRect.width/2 - canvasRect.left) / state.scale;
                const y2 = (tRect.top + tRect.height/2 - canvasRect.top) / state.scale;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('class', 'connection-path');
                path.setAttribute('d', getBezierPath(x1, y1, x2, y2));
                
                connectionsLayer.appendChild(path);
            }
        });
    }

    function updateConnectionsForNode(nodeId) {
        renderConnections();
    }

    function getBezierPath(x1, y1, x2, y2) {
        const cpOffset = Math.abs(x2 - x1) * 0.5;
        const cp1x = x1 + cpOffset;
        const cp1y = y1;
        const cp2x = x2 - cpOffset;
        const cp2y = y2;
        return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }

    // --- TOOLBAR ---
    function setupToolbar() {
        document.getElementById('view-zoom-in').addEventListener('click', () => {
            state.scale = Math.min(5, state.scale + 0.1);
            updateCanvasTransform();
        });
        document.getElementById('view-zoom-out').addEventListener('click', () => {
            state.scale = Math.max(0.1, state.scale - 0.1);
            updateCanvasTransform();
        });
        
        const btnAddQuestion = document.getElementById('btn-add-question');
        if (btnAddQuestion) {
            btnAddQuestion.addEventListener('click', () => {
                const rect = canvasContainer.getBoundingClientRect();
                const centerX = (rect.width / 2 - state.panX) / state.scale;
                const centerY = (rect.height / 2 - state.panY) / state.scale;
                createNode('question', centerX - 75, centerY - 50);
            });
        }

        document.getElementById('btn-save').addEventListener('click', saveFlow);
        document.getElementById('btn-run-test').addEventListener('click', runSimulation);
    }

    // --- SIMULATION ---
    async function runSimulation() {
        console.log("Starting Simulation...");
        
        let currentNode = state.nodes.find(n => n.type === 'start');
        if (!currentNode) {
            alert("Error: No 'Start Flow' node found.");
            return;
        }

        const vars = {}; 

        while (currentNode) {
            console.log("Step:", currentNode.type, currentNode.id);

            // Execute Node Logic
            if (currentNode.type === 'start') {
                // Just pass through
            }
            else if (currentNode.type === 'question') {
                const q = currentNode.data.question_text;
                const type = currentNode.data.input_type;
                let answer = null;

                if (type === 'multiple_choice') {
                    const options = currentNode.data.answer_options || [];
                    const optionsText = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
                    const choice = prompt(`[Bot]: ${q}\n\n${optionsText}\n(Enter number)`);
                    if (choice) {
                        const idx = parseInt(choice) - 1;
                        if (options[idx]) {
                            answer = idx; // Store index for port mapping
                            vars[currentNode.id] = options[idx];
                        }
                    }
                } else if (type === 'yes_no') {
                    const choice = confirm(`[Bot]: ${q}\n(OK = Yes, Cancel = No)`);
                    answer = choice ? 'yes' : 'no';
                    vars[currentNode.id] = answer;
                } else if (type === 'text_area') {
                    // Text Area
                    const val = prompt(`[Bot]: ${q} (Enter long text)`);
                    answer = 'next';
                    vars[currentNode.id] = val;
                } else {
                    // Number, File
                    const val = prompt(`[Bot]: ${q} (${type})`);
                    answer = 'next';
                    vars[currentNode.id] = val;
                }
                
                // If user cancelled prompt (and it wasn't yes/no), stop
                if (answer === null && type !== 'yes_no') {
                    if (confirm("Stop simulation?")) break;
                }

                currentNode.lastAnswer = answer; // Store for link finding
            }
            else if (currentNode.type === 'end') {
                alert("Flow Ended.");
                break;
            }

            // Find Next Node
            const nextLink = getNextLink(currentNode);
            if (!nextLink) {
                if (currentNode.type !== 'end') alert("Flow stopped (end of path).");
                break;
            }
            
            currentNode = state.nodes.find(n => n.id === nextLink.target);
        }
    }

    function getNextLink(node) {
        if (node.type === 'start') {
            return state.connections.find(c => c.source === node.id && c.sourcePort === 'out_start');
        }
        
        if (node.type === 'question') {
            const type = node.data.input_type;
            const ans = node.lastAnswer;
            
            if (type === 'multiple_choice') {
                // ans is index
                const portId = `out_opt_${ans}`;
                return state.connections.find(c => c.source === node.id && c.sourcePort === portId);
            } else if (type === 'yes_no') {
                const portId = `out_${ans}`; // 'out_yes' or 'out_no'
                return state.connections.find(c => c.source === node.id && c.sourcePort === portId);
            } else {
                return state.connections.find(c => c.source === node.id && c.sourcePort === 'out_next');
            }
        }

        // Generic fallback (first output)
        return state.connections.find(c => c.source === node.id);
    }

    // --- INSPECTOR & SELECTION ---

    function selectNode(id) {
        document.querySelectorAll('.flow-node.selected').forEach(el => el.classList.remove('selected'));
        state.selectedNodeId = id;
        
        const el = document.getElementById(id);
        if (el) el.classList.add('selected');
        
        updateInspector(id);
    }

    function updateInspector(id) {
        const node = state.nodes.find(n => n.id === id);
        if (!node) {
            inspectorContent.innerHTML = '<p class="text-muted text-center mt-5">Select a node to edit properties.</p>';
            return;
        }

        let html = '';

        if (node.type === 'question') {
            html += `
                <div class="mb-3">
                    <label class="form-label">Question Text</label>
                    <input type="text" class="form-control" value="${node.data.question_text}" oninput="updateQuestionData('${id}', 'question_text', this.value)">
                </div>
                <div class="mb-3">
                    <label class="form-label">Input Type</label>
                    <select class="form-select" onchange="updateQuestionData('${id}', 'input_type', this.value)">
                        <option value="multiple_choice" ${node.data.input_type === 'multiple_choice' ? 'selected' : ''}>Multiple Choice</option>
                        <option value="yes_no" ${node.data.input_type === 'yes_no' ? 'selected' : ''}>Yes/No</option>
                        <option value="number" ${node.data.input_type === 'number' ? 'selected' : ''}>Number</option>
                        <option value="text_area" ${node.data.input_type === 'text_area' ? 'selected' : ''}>Text Area</option>
                        <option value="file_upload" ${node.data.input_type === 'file_upload' ? 'selected' : ''}>File Upload</option>
                    </select>
                </div>
            `;

            if (node.data.input_type === 'multiple_choice') {
                html += `
                <div class="mb-3">
                    <label class="form-label">Answer Options</label>
                    <ul class="list-group mb-2" id="inspector-options-list">
                        ${(node.data.answer_options || []).map((opt, idx) => `
                            <li class="list-group-item d-flex justify-content-between align-items-center p-1">
                                <input type="text" class="form-control form-control-sm border-0" value="${opt}" onchange="updateOption('${id}', ${idx}, this.value)">
                                <button class="btn btn-sm text-danger" onclick="removeOption('${id}', ${idx})"><i class="fas fa-times"></i></button>
                            </li>
                        `).join('')}
                    </ul>
                    <button class="btn btn-sm btn-outline-primary w-100" onclick="addOption('${id}')"><i class="fas fa-plus"></i> Add Option</button>
                </div>
                `;
            }
        } else if (node.type === 'start') {
            html = `<p class="text-muted">Start Node: The entry point of your script.</p>`;
        } else {
            html = `<p class="text-muted">No editable properties for this node type.</p>`;
        }

        // Delete Button (if not Start node)
        if (node.type !== 'start') {
            html += `
                <hr class="my-4">
                <button class="btn btn-danger w-100" onclick="deleteNode('${id}')">
                    <i class="fas fa-trash"></i> Delete Node
                </button>
            `;
        }

        inspectorContent.innerHTML = html;
    }

    // Global helpers for inline events
    window.deleteNode = (id) => {
        if (!confirm("Are you sure you want to delete this node?")) return;

        // Remove from nodes
        const index = state.nodes.findIndex(n => n.id === id);
        if (index > -1) {
            state.nodes.splice(index, 1);
        }

        // Remove connections
        state.connections = state.connections.filter(c => c.source !== id && c.target !== id);

        // Remove DOM element
        const el = document.getElementById(id);
        if (el) el.remove();

        // Clear selection
        if (state.selectedNodeId === id) {
            state.selectedNodeId = null;
            inspectorContent.innerHTML = '<p class="text-muted text-center mt-5">Select a node to edit properties.</p>';
        }

        renderConnections();
    };

    // Keyboard shortcut for deletion
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedNodeId) {
            // Check if focus is not in an input
            if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                const node = state.nodes.find(n => n.id === state.selectedNodeId);
                if (node && node.type !== 'start') {
                    window.deleteNode(state.selectedNodeId);
                }
            }
        }
    });

    window.updateQuestionData = (id, key, value) => {
        const node = state.nodes.find(n => n.id === id);
        if (node) {
            node.data[key] = value;
            // Reset options if switching types to avoid data cruft (optional)
            if (key === 'input_type') {
                if (value === 'multiple_choice' && !node.data.answer_options) {
                    node.data.answer_options = ['Option 1', 'Option 2'];
                }
                // We re-render to show correct ports
            }
            renderNode(node); 
            // Also update inspector to show/hide options list
            updateInspector(id);
        }
    };
    
    // ... existing helpers ...

    window.updateOption = (id, idx, value) => {
        const node = state.nodes.find(n => n.id === id);
        if (node && node.data.answer_options) {
            node.data.answer_options[idx] = value;
            renderNode(node);
        }
    };

    window.removeOption = (id, idx) => {
        const node = state.nodes.find(n => n.id === id);
        if (node && node.data.answer_options) {
            node.data.answer_options.splice(idx, 1);
            renderNode(node);
            updateInspector(id); // Re-render inspector to update indices
        }
    };

    window.addOption = (id) => {
        const node = state.nodes.find(n => n.id === id);
        if (node) {
            if (!node.data.answer_options) node.data.answer_options = [];
            node.data.answer_options.push("New Option");
            renderNode(node);
            updateInspector(id);
        }
    };

    // --- UTILS ---
    function formatLabel(type) {
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
    
    function formatInputType(type) {
        return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    function setupDragDrop() {
        const draggables = document.querySelectorAll('.draggable-node');
        
        draggables.forEach(d => {
            d.addEventListener('dragstart', (e) => {
                state.draggedNodeType = d.dataset.type;
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        canvasContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvasContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            if (state.draggedNodeType) {
                const canvasRect = canvasLayer.getBoundingClientRect();
                const x = (e.clientX - canvasRect.left) / state.scale;
                const y = (e.clientY - canvasRect.top) / state.scale;
                
                createNode(state.draggedNodeType, x, y);
                state.draggedNodeType = null;
            }
        });
    }

    // --- SAVE ---
    async function saveFlow() {
        const flowData = {
            nodes: state.nodes,
            connections: state.connections,
            viewport: { x: state.panX, y: state.panY, scale: state.scale }
        };

        const btn = document.getElementById('btn-save');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const serviceId = document.body.dataset.serviceId;
            const businessId = document.body.dataset.businessId;
            
            const response = await fetch(`/sme/business/${businessId}/services/${serviceId}/builder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ script: JSON.stringify(flowData) })
            });
            
            if (response.ok) {
                btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
                setTimeout(() => btn.innerHTML = originalText, 2000);
            } else {
                throw new Error('Save failed');
            }
        } catch (err) {
            console.error(err);
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            setTimeout(() => btn.innerHTML = originalText, 2000);
        }
    }

    // Run
    init();

    // Load existing (basic support)
    if (typeof savedScript !== 'undefined' && savedScript.nodes) {
        state.nodes = savedScript.nodes || [];
        state.connections = savedScript.connections || [];
        if (savedScript.viewport) {
            state.panX = savedScript.viewport.x;
            state.panY = savedScript.viewport.y;
            state.scale = savedScript.viewport.scale;
        }
        updateCanvasTransform();
        state.nodes.forEach(n => {
            renderNode(n);
            // Fix nextId
            const nid = parseInt(n.id.replace('node_', ''));
            if (!isNaN(nid)) state.nextId = Math.max(state.nextId, nid + 1);
        });
    }
});