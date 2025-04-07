import { useState, useCallback } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  Handle,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

// Componente customizado para os nós com handles
const CustomNode = ({ data, selected }) => (
  <div
    className={`custom-node ${selected ? 'selected' : ''}`}
    style={{ backgroundColor: data.color || '#f0f0f0' }} // Aplica a cor do nó
  >
    <Handle type="target" position="top" />
    <div>{data.label}</div>
    <Handle type="source" position="bottom" />
  </div>
);

// Definir tipos de nós
const nodeTypes = {
  custom: CustomNode,
};

// Nós iniciais
const initialNodes = [
  {
    id: '1',
    type: 'custom',
    position: { x: 250, y: 5 },
    data: { label: 'Ideia Principal', color: '#f0f0f0' },
    draggable: true,
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 400, y: 100 },
    data: { label: 'Ideia Secundária', color: '#f0f0f0' },
    draggable: true,
  },
];

// Bordas iniciais
const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
];

// Paleta de cores
const colorPalette = [
  '#ff9999', // Vermelho claro
  '#99ff99', // Verde claro
  '#9999ff', // Azul claro
  '#ffff99', // Amarelo claro
  '#ff99ff', // Rosa claro
  '#f0f0f0', // Cinza padrão (reset)
];

function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [activeNode, setActiveNode] = useState(null); // Nó atualmente ativo para colorir

  // Função para adicionar um novo nó
  const onAddNode = useCallback(() => {
    let newPosition;
    if (selectedNodes.length > 0) {
      const selectedNode = nodes.find((n) => n.id === selectedNodes[0]);
      newPosition = {
        x: selectedNode.position.x,
        y: selectedNode.position.y + 100,
      };
    } else {
      newPosition = { x: Math.random() * 500, y: Math.random() * 500 };
    }

    const newNode = {
      id: `${nodes.length + 1}`,
      type: 'custom',
      position: newPosition,
      data: { label: `Ideia ${nodes.length + 1}`, color: '#f0f0f0' },
      draggable: true,
    };
    setNodes((nds) => nds.concat(newNode));
  }, [nodes, selectedNodes]);

  // Função para conectar nós
  const onConnect = useCallback(
    (params) => {
      const newEdge = { ...params, animated: true };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    []
  );

  // Função para editar o rótulo do nó com duplo clique
  const onNodeDoubleClick = useCallback((event, node) => {
    const newLabel = prompt('Digite o novo texto:', node.data.label);
    if (newLabel) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n
        )
      );
    }
  }, []);

  // Função para detectar clique simples no nó
  const onNodeClick = useCallback((event, node) => {
    if (event.ctrlKey || event.shiftKey) {
      setSelectedNodes((prev) =>
        prev.includes(node.id)
          ? prev.filter((id) => id !== node.id)
          : [...prev, node.id]
      );
    } else {
      setSelectedNodes([node.id]);
      setActiveNode(node.id); // Define o nó ativo para colorir
    }
  }, []);

  // Função para aplicar cor ao nó ativo
  const applyColor = useCallback(
    (color) => {
      if (activeNode) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === activeNode ? { ...n, data: { ...n.data, color } } : n
          )
        );
      }
    },
    [activeNode]
  );

  // Sincroniza o estado selected dos nós com selectedNodes
  const syncedNodes = nodes.map((node) => ({
    ...node,
    selected: selectedNodes.includes(node.id),
  }));

  // Função para atualizar a posição dos nós ao arrastar
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  // Função para excluir uma borda ao clicar nela
  const onEdgeClick = useCallback((event, edge) => {
    const confirmDelete = window.confirm(
      `Deseja excluir a conexão entre ${edge.source} e ${edge.target}?`
    );
    if (confirmDelete) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }
  }, []);

  // Função para salvar o mapa no localStorage e sessionStorage
  const saveMap = useCallback(() => {
    const mapData = JSON.stringify({ nodes: syncedNodes, edges });
    localStorage.setItem('mindMap', mapData);

    const sessionMap1 = sessionStorage.getItem('mindMap');
    if (!sessionMap1) {
      sessionStorage.setItem('mindMap', mapData);
      alert('Mapa salvo em LocalStorage e SessionStorage (mindMap)!');
    } else {
      sessionStorage.setItem('mindMap2', mapData);
      alert('Mapa salvo em LocalStorage e SessionStorage (mindMap2)!');
    }
  }, [syncedNodes, edges]);

  // Função para carregar o mapa do localStorage ou sessionStorage
  const loadMap = useCallback(() => {
    const savedLocal = localStorage.getItem('mindMap');
    const savedSession = sessionStorage.getItem('mindMap');
    const savedSession2 = sessionStorage.getItem('mindMap2');

    if (savedLocal) {
      const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedLocal);
      setNodes(savedNodes);
      setEdges(savedEdges);
      setSelectedNodes(savedNodes.filter((n) => n.selected).map((n) => n.id));
      alert('Mapa carregado do LocalStorage!');
    } else if (savedSession) {
      const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedSession);
      setNodes(savedNodes);
      setEdges(savedEdges);
      setSelectedNodes(savedNodes.filter((n) => n.selected).map((n) => n.id));
      alert('Mapa carregado do SessionStorage (mindMap)!');
    } else if (savedSession2) {
      const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedSession2);
      setNodes(savedNodes);
      setEdges(savedEdges);
      setSelectedNodes(savedNodes.filter((n) => n.selected).map((n) => n.id));
      alert('Mapa carregado do SessionStorage (mindMap2)!');
    } else {
      alert('Nenhum mapa salvo encontrado.');
    }
  }, []);

  // Função para limpar o mapa
  const clearMap = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodes([]);
    setActiveNode(null);
  }, []);

  return (
    <div className="app-container">
      <ReactFlow
        nodes={syncedNodes}
        edges={edges}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      <div className="controls">
        <button onClick={onAddNode}>Adicionar Nó</button>
        <button onClick={saveMap}>Salvar Mapa</button>
        <button onClick={loadMap}>Carregar Mapa</button>
        <button onClick={clearMap}>Limpar Tudo</button>
      </div>

      {/* Paleta de cores */}
      <div className="color-palette">
        {colorPalette.map((color) => (
          <button
            key={color}
            className="color-button"
            style={{ backgroundColor: color }}
            onClick={() => applyColor(color)}
            title={`Aplicar ${color}`}
          />
        ))}
      </div>
    </div>
  );
}

export default App;