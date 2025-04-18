import React, { useState, useCallback, useEffect } from 'react';
import { FiPlus, FiSun } from "react-icons/fi";
import { FaPalette } from "react-icons/fa";
import { ChromePicker } from 'react-color';
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
import { db } from './firebase';
import { collection, addDoc, getDocs, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';

// Componente customizado para os nós com handles
const CustomNode = ({ data, selected }) => (
  <div
    className={`custom-node ${selected ? 'selected' : ''}`}
    style={{ backgroundColor: data.color || 'var(--button-bg)' }}
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

// Paletas predefinidas
const defaultPalettes = {
  'Padrão': [
    '#ff9999',
    '#99ff99',
    '#9999ff',
    '#ffff99',
    '#ff99ff',
    'var(--button-bg)',
  ],
  'Azuis': [
    '#87CEEB', // Azul Celeste
    '#4169E1', // Azul Royal
    '#40E0D0', // Azul Turquesa
    '#000080', // Azul Marinho
    '#89CFF0', // Azul Bebê
    'var(--button-bg)',
  ],
  'Escura': [
    '#4B0082',
    '#2F4F4F',
    '#8B0000',
    '#006400',
    '#4A4A4A',
    'var(--button-bg)',
  ],
};

// Nós iniciais
const initialNodes = [
  {
    id: '1',
    type: 'custom',
    position: { x: 250, y: 5 },
    data: { label: 'Ideia Principal', color: 'var(--button-bg)' },
    draggable: true,
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 400, y: 100 },
    data: { label: 'Ideia Secundária', color: 'var(--button-bg)' },
    draggable: true,
  },
];

// Bordas iniciais
const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
];

function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [activeNode, setActiveNode] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light-theme');
  const [palettes, setPalettes] = useState(() => {
    const saved = localStorage.getItem('palettes');
    return saved ? JSON.parse(saved) : defaultPalettes;
  });
  const [currentPalette, setCurrentPalette] = useState('Padrão');
  const [showAddPalette, setShowAddPalette] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newPaletteColors, setNewPaletteColors] = useState([]);
  const [maps, setMaps] = useState([]);
  const [currentMapId, setCurrentMapId] = useState(null);
  const [mapName, setMapName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const userId = 'anonymous'; // Substitua por auth.currentUser?.uid com autenticação

  // Carregar lista de mapas do Firestore
  useEffect(() => {
    const fetchMaps = async () => {
      setLoading(true);
      try {
        const mapsCollection = collection(db, `mindMaps/${userId}/maps`);
        const mapsSnapshot = await getDocs(mapsCollection);
        const mapsList = mapsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMaps(mapsList);
        setLoading(false);
      } catch (err) {
        setError('Erro ao carregar mapas: ' + err.message);
        setLoading(false);
      }
    };
    fetchMaps();
  }, [userId]);

  // Salvar tema e paletas no localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('palettes', JSON.stringify(palettes));
  }, [theme, palettes]);

  const mudarTema = useCallback(() => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para mudar o tema.');
      return;
    }
    setTheme((prev) => (prev === 'light-theme' ? 'dark-theme' : 'light-theme'));
  }, [isLocked]);

  const onAddNode = useCallback(() => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para adicionar novos nós.');
      return;
    }
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
      data: { label: `Ideia ${nodes.length + 1}`, color: 'var(--button-bg)' },
      draggable: true,
    };
    setNodes((nds) => nds.concat(newNode));
  }, [nodes, selectedNodes, isLocked]);

  const onConnect = useCallback(
    (params) => {
      if (isLocked) {
        alert('O mapa está trancado. Desbloqueie para conectar nós.');
        return;
      }
      const newEdge = { ...params, animated: true };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [isLocked]
  );

  const onNodeDoubleClick = useCallback(
    (event, node) => {
      if (isLocked) {
        alert('O mapa está trancado. Desbloqueie para editar rótulos.');
        return;
      }
      const newLabel = prompt('Digite o novo texto:', node.data.label);
      if (newLabel) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n
          )
        );
      }
    },
    [isLocked]
  );

  const onNodeClick = useCallback((event, node) => {
    if (event.ctrlKey || event.shiftKey) {
      setSelectedNodes((prev) =>
        prev.includes(node.id)
          ? prev.filter((id) => id !== node.id)
          : [...prev, node.id]
      );
    } else {
      setSelectedNodes([node.id]);
      setActiveNode(node.id);
    }
  }, []);

  const applyColor = useCallback(
    (color) => {
      if (isLocked) {
        alert('O mapa está trancado. Desbloqueie para mudar cores.');
        return;
      }
      if (activeNode) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === activeNode ? { ...n, data: { ...n.data, color } } : n
          )
        );
      }
    },
    [activeNode, isLocked]
  );

  const changePalette = useCallback(
    (paletteName) => {
      if (isLocked) {
        alert('O mapa está trancado. Desbloqueie para mudar a paleta.');
        return;
      }
      setCurrentPalette(paletteName);
    },
    [isLocked]
  );

  const addNewPalette = useCallback(() => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para adicionar paletas.');
      return;
    }
    if (!newPaletteName || newPaletteColors.length === 0) {
      alert('Por favor, preencha o nome e adicione pelo menos uma cor à paleta.');
      return;
    }

    const newPalette = [...newPaletteColors, 'var(--button-bg)'];
    setPalettes((prev) => ({
      ...prev,
      [newPaletteName]: newPalette,
    }));
    setCurrentPalette(newPaletteName);
    setNewPaletteName('');
    setNewPaletteColors([]);
    setShowAddPalette(false);
    alert(`Paleta "${newPaletteName}" adicionada com sucesso!`);
  }, [newPaletteName, newPaletteColors, isLocked]);

  const handleColorChange = useCallback((color) => {
    setNewPaletteColors((prev) => [...prev, color.hex]);
  }, []);

  const removeColor = useCallback((index) => {
    setNewPaletteColors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const syncedNodes = nodes.map((node) => ({
    ...node,
    selected: selectedNodes.includes(node.id),
    draggable: !isLocked,
  }));

  const onNodesChange = useCallback(
    (changes) => {
      if (isLocked) {
        return;
      }
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [isLocked]
  );

  const onEdgeClick = useCallback(
    (event, edge) => {
      if (isLocked) {
        alert('O mapa está trancado. Desbloqueie para excluir bordas.');
      }
      const confirmDelete = window.confirm(
        `Deseja excluir a conexão entre ${edge.source} e ${edge.target}?`
      );
      if (confirmDelete) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
    },
    [isLocked]
  );

  const saveMap = useCallback(async () => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para salvar.');
      return;
    }
    if (!mapName) {
      alert('Por favor, insira um nome para o mapa.');
      return;
    }
    setLoading(true);
    try {
      const mapData = {
        name: mapName,
        nodes: syncedNodes,
        edges,
        palettes,
        updatedAt: Timestamp.now()
      };
      let newMapId = currentMapId;
      if (currentMapId) {
        const mapRef = doc(db, `mindMaps/${userId}/maps`, currentMapId);
        await updateDoc(mapRef, mapData);
        alert('Mapa atualizado com sucesso no Firestore!');
      } else {
        mapData.createdAt = Timestamp.now();
        const mapsCollection = collection(db, `mindMaps/${userId}/maps`);
        const docRef = await addDoc(mapsCollection, mapData);
        newMapId = docRef.id;
        setCurrentMapId(newMapId);
        setMaps((prev) => [...prev, { id: newMapId, ...mapData }]);
        alert('Mapa salvo com sucesso no Firestore!');
      }
      localStorage.setItem('mindMap', JSON.stringify({ nodes: syncedNodes, edges }));
      localStorage.setItem('currentMapId', newMapId);
      localStorage.setItem('mapName', mapName);
      setLoading(false);
    } catch (err) {
      setError('Erro ao salvar mapa: ' + err.message);
      setLoading(false);
    }
  }, [isLocked, mapName, syncedNodes, edges, palettes, currentMapId, userId]);

  const loadMap = useCallback(async (mapId) => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para carregar.');
      return;
    }
    setLoading(true);
    try {
      const mapDoc = await getDoc(doc(db, `mindMaps/${userId}/maps`, mapId));
      if (mapDoc.exists()) {
        const mapData = mapDoc.data();
        setNodes(mapData.nodes || initialNodes);
        setEdges(mapData.edges || initialEdges);
        setPalettes((prev) => ({ ...prev, ...mapData.palettes }));
        setSelectedNodes(mapData.nodes.filter((n) => n.selected).map((n) => n.id));
        setCurrentMapId(mapId);
        setMapName(mapData.name);
        localStorage.setItem('palettes', JSON.stringify({ ...palettes, ...mapData.palettes }));
        localStorage.setItem('currentMapId', mapId);
        localStorage.setItem('mapName', mapData.name);
        alert('Mapa carregado do Firestore!');
      } else {
        alert('Mapa não encontrado no Firestore.');
      }
      setLoading(false);
    } catch (err) {
      setError('Erro ao carregar mapa: ' + err.message);
      setLoading(false);
      const savedLocal = localStorage.getItem('mindMap');
      if (savedLocal) {
        const { nodes: savedNodes, edges: savedEdges } = JSON.parse(savedLocal);
        setNodes(savedNodes);
        setEdges(savedEdges);
        setSelectedNodes(savedNodes.filter((n) => n.selected).map((n) => n.id));
        setMapName(localStorage.getItem('mapName') || '');
        setCurrentMapId(localStorage.getItem('currentMapId') || null);
        alert('Mapa carregado do localStorage (fallback).');
      } else {
        alert('Nenhum mapa salvo encontrado no localStorage.');
      }
    }
  }, [isLocked, userId, palettes, initialNodes, initialEdges]);

  const newMap = useCallback(() => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para criar um novo mapa.');
      return;
    }
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodes([]);
    setActiveNode(null);
    setCurrentMapId(null);
    setMapName('');
    setPalettes(defaultPalettes);
    localStorage.removeItem('mindMap');
    localStorage.removeItem('currentMapId');
    localStorage.removeItem('mapName');
    localStorage.setItem('palettes', JSON.stringify(defaultPalettes));
    alert('Novo mapa criado!');
  }, [isLocked]);

  const exportMap = useCallback(() => {
    const mapData = JSON.stringify({ nodes: syncedNodes, edges, palettes, name: mapName });
    const blob = new Blob([mapData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mapName || 'mapa-mental'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [syncedNodes, edges, palettes, mapName]);

  const importMap = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { nodes: importedNodes, edges: importedEdges, palettes: importedPalettes, name } = JSON.parse(e.target.result);
          setNodes(importedNodes);
          setEdges(importedEdges);
          setPalettes((prev) => ({ ...prev, ...importedPalettes }));
          setSelectedNodes(importedNodes.filter((n) => n.selected).map((n) => n.id));
          setMapName(name || '');
          alert('Mapa importado com sucesso!');
        } catch (error) {
          alert('Erro ao importar o mapa: arquivo inválido.');
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const clearMap = useCallback(() => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para limpar.');
      return;
    }
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodes([]);
    setActiveNode(null);
  }, [isLocked]);

  const handleInteractiveChange = useCallback((interactive) => {
    setIsLocked(!interactive);
  }, []);

  return (
    <div className={`app-container ${theme}`}>
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
        interactive={!isLocked}
      >
        <Background />
        <Controls onInteractiveChange={handleInteractiveChange} />
        <MiniMap />
      </ReactFlow>

      <div className="controls">
        <button onClick={onAddNode} disabled={loading || isLocked}><FiPlus /></button>
        <input
          type="text"
          placeholder="Nome do mapa"
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
          disabled={loading || isLocked}
          className="map-name-input"
        />
        <button onClick={saveMap} disabled={loading || isLocked}>
          {loading ? 'Salvando...' : 'Salvar Mapa'}
        </button>
        <select
          value={currentMapId || ''}
          onChange={(e) => e.target.value && loadMap(e.target.value)}
          disabled={loading || isLocked}
          className="map-selector"
        >
          <option value="">Selecione um mapa</option>
          {maps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name}
            </option>
          ))}
        </select>
        <button onClick={newMap} disabled={loading || isLocked}>Novo Mapa</button>
        <button onClick={clearMap} disabled={loading || isLocked}>Limpar Tudo</button>
        <button onClick={exportMap} disabled={loading || isLocked}>Exportar Mapa</button>
        <label htmlFor="import-map" className="import-button">
          Importar Mapa
          <input
            id="import-map"
            type="file"
            accept=".json"
            onChange={importMap}
            style={{ display: 'none' }}
            disabled={loading || isLocked}
          />
        </label>
        <button onClick={mudarTema} disabled={loading || isLocked} aria-label={`Alternar para ${theme === 'light-theme' ? 'tema escuro' : 'tema claro'}`}>
          <FiSun />
        </button>
        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="color-palette">
        <div className="palette-selector">
          <select
            value={currentPalette}
            onChange={(e) => changePalette(e.target.value)}
            disabled={loading || isLocked}
            aria-label="Selecionar paleta de cores"
          >
            {Object.keys(palettes).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddPalette(true)}
            disabled={loading || isLocked}
            aria-label="Adicionar nova paleta"
          >
            <FaPalette />
          </button>
        </div>
        {showAddPalette && (
          <div className="add-palette-form">
            <input
              type="text"
              placeholder="Nome da paleta"
              value={newPaletteName}
              onChange={(e) => setNewPaletteName(e.target.value)}
              disabled={loading || isLocked}
            />
            <div className="color-picker-container">
              <ChromePicker
                color={newPaletteColors[newPaletteColors.length - 1] || '#ffffff'}
                onChangeComplete={handleColorChange}
                disableAlpha={true}
                disabled={loading || isLocked}
              />
              <div className="selected-colors">
                {newPaletteColors.map((color, index) => (
                  <div
                    key={index}
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                    onClick={() => removeColor(index)}
                    title={`Remover ${color}`}
                  />
                ))}
              </div>
            </div>
            <button onClick={addNewPalette} disabled={loading || isLocked}>
              Adicionar
            </button>
            <button
              onClick={() => setShowAddPalette(false)}
              disabled={loading || isLocked}
            >
              Cancelar
            </button>
          </div>
        )}
        <div className="color-buttons">
          {palettes[currentPalette].map((color) => (
            <button
              key={color}
              className="color-button"
              style={{ backgroundColor: color }}
              onClick={() => applyColor(color)}
              title={`Aplicar ${color}`}
              disabled={loading || isLocked}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;