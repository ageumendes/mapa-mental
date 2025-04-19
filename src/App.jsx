import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { FiPlus, FiSun, FiMenu } from "react-icons/fi";
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
import { db, auth } from './firebase';
import { collection, addDoc, getDocs, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { throttle } from 'lodash';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PptxGenJS from 'pptxgenjs';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';

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

// Definir tipos de nós fora do componente
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
  { id: 'e1-2', source: '1', target: '2', animated: false },
];

// Componente para exibir o feed de mapas
const MapFeed = ({ maps, loadMap, closeFeed, theme, isLocked }) => {
  return (
    <div className={`map-feed ${theme}`}>
      <div className="feed-header">
        <h2>Seus Mapas Mentais</h2>
        <button onClick={closeFeed} className="close-feed-button">Fechar</button>
      </div>
      <div className="feed-content">
        {maps.length === 0 ? (
          <p>Nenhum mapa salvo encontrado.</p>
        ) : (
          maps.map((map) => (
            <div
              key={map.id}
              className="map-preview"
              onClick={() => !isLocked && loadMap(map.id)}
              style={{ cursor: isLocked ? 'not-allowed' : 'pointer' }}
            >
              <div className="map-preview-content">
                <h3>{map.name}</h3>
                <p>
                  Última atualização:{' '}
                  {map.updatedAt?.toDate().toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p>Nós: {map.nodes?.length || 0} | Conexões: {map.edges?.length || 0}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

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
  const [userId, setUserId] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');
  const [isDragging, setIsDragging] = useState(false);
  const [showFeed, setShowFeed] = useState(false); // Estado para controlar o feed
  const reactFlowInstance = useRef(null);

  // Configurar autenticação anônima com retry
  useEffect(() => {
    const authenticate = async () => {
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          const userCredential = await signInAnonymously(auth);
          console.log('Autenticado anonimamente:', userCredential.user.uid);
          setUserId(userCredential.user.uid);
          return;
        } catch (error) {
          console.error(`Tentativa ${i + 1} de autenticação falhou:`, error);
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }
      setError('Erro na autenticação após várias tentativas.');
      setUserId(null);
    };

    authenticate();

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('Usuário autenticado:', user.uid);
        setUserId(user.uid);
      } else {
        console.log('Nenhum usuário autenticado');
        setUserId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Carregar lista de mapas do Firestore com retry
  useEffect(() => {
    if (!userId) return;
    const fetchMaps = async () => {
      setLoading(true);
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        try {
          console.log('Conectando ao Firestore...');
          const mapsCollection = collection(db, `mindMaps/${userId}/maps`);
          const mapsSnapshot = await getDocs(mapsCollection);
          console.log('Mapas recebidos:', mapsSnapshot.docs.length);
          const mapsList = mapsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMaps(mapsList);
          setLoading(false);
          return;
        } catch (err) {
          console.error(`Tentativa ${i + 1} falhou:`, err);
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }
      setError('Erro ao carregar mapas após várias tentativas.');
      setLoading(false);
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
      const newEdge = { ...params, animated: false };
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

  const syncedNodes = useMemo(() => {
    const selectedSet = new Set(selectedNodes);
    return nodes.map((node) => ({
      ...node,
      selected: selectedSet.has(node.id),
      draggable: !isLocked,
    }));
  }, [nodes, selectedNodes, isLocked]);

  const onNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onNodeDragStop = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onNodesChange = useCallback(
    throttle((changes) => {
      if (isLocked) return;
      setNodes((nds) => applyNodeChanges(changes, nds));
    }, 50),
    [isLocked]
  );

  const onEdgeClick = useCallback(
    (event, edge) => {
      if (isLocked) {
        alert('O mapa está trancado. Desbloqueie para excluir bordas.');
        return;
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
    if (!userId) {
      alert('Usuário não autenticado. Tente novamente.');
      return;
    }
    setLoading(true);
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
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
        return;
      } catch (err) {
        console.error(`Tentativa ${i + 1} falhou:`, err);
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    setError('Erro ao salvar mapa após várias tentativas.');
    setLoading(false);
  }, [isLocked, mapName, syncedNodes, edges, palettes, currentMapId, userId]);

  const loadMap = useCallback(async (mapId) => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para carregar.');
      return;
    }
    if (!userId) {
      alert('Usuário não autenticado. Tente novamente.');
      return;
    }
    setLoading(true);
    try {
      console.log('Carregando mapa com ID:', mapId);
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
      setShowFeed(false); // Fechar o feed ao carregar um mapa
    } catch (err) {
      console.error('Erro ao carregar mapa:', err);
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

  const getMapBounds = useCallback(() => {
    if (!nodes.length) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }

    const padding = 50;
    const nodeWidth = 150;
    const nodeHeight = 50;

    const bounds = nodes.reduce(
      (acc, node) => ({
        minX: Math.min(acc.minX, node.position.x),
        maxX: Math.max(acc.maxX, node.position.x + nodeWidth),
        minY: Math.min(acc.minY, node.position.y),
        maxY: Math.max(acc.maxY, node.position.y + nodeHeight),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    return {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      width: bounds.maxX - bounds.minX + 2 * padding,
      height: bounds.maxY - bounds.minY + 2 * padding,
    };
  }, [nodes]);

  const exportMap = useCallback(async () => {
    if (isLocked) {
      alert('O mapa está trancado. Desbloqueie para exportar.');
      return;
    }
    if (!mapName) {
      alert('Por favor, insira um nome para o mapa.');
      return;
    }
    setLoading(true);
    try {
      const fileName = `${mapName || 'mapa-mental'}`;
      const reactFlowElement = document.querySelector('.react-flow__viewport');

      if (exportFormat === 'png' || exportFormat === 'jpg' || exportFormat === 'pdf' || exportFormat === 'pptx') {
        const bounds = getMapBounds();
        let viewportWidth = bounds.width;
        let viewportHeight = bounds.height;

        const desiredNodeWidth = 100;
        const nodeWidth = 150;
        const minZoom = desiredNodeWidth / nodeWidth;
        const maxCanvasSize = 8000;

        let targetZoom = minZoom;
        viewportWidth *= targetZoom;
        viewportHeight *= targetZoom;

        const maxDimension = Math.max(viewportWidth, viewportHeight);
        if (maxDimension > maxCanvasSize) {
          const scaleFactor = maxCanvasSize / maxDimension;
          targetZoom *= scaleFactor;
          viewportWidth *= scaleFactor;
          viewportHeight *= scaleFactor;
        }

        const originalTransform = reactFlowInstance.current.getViewport();
        reactFlowInstance.current.setViewport({
          x: -bounds.x * targetZoom,
          y: -bounds.y * targetZoom,
          zoom: targetZoom,
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(reactFlowElement, {
          scale: 2,
          width: viewportWidth,
          height: viewportHeight,
          x: bounds.x,
          y: bounds.y,
          backgroundColor: theme === 'light-theme' ? '#ffffff' : '#1a1a1a',
        });

        reactFlowInstance.current.setViewport(originalTransform);

        if (exportFormat === 'png' || exportFormat === 'jpg') {
          const imgData = canvas.toDataURL(`image/${exportFormat}`);
          const link = document.createElement('a');
          link.href = imgData;
          link.download = `${fileName}.${exportFormat}`;
          link.click();
        } else if (exportFormat === 'pdf') {
          const imgData = canvas.toDataURL('image/png');
          const aspectRatio = viewportWidth / viewportHeight;
          const a4WidthPx = 2480;
          const a4HeightPx = 3508;
          let pdfWidth, pdfHeight;

          if (viewportWidth > viewportHeight) {
            pdfWidth = a4WidthPx;
            pdfHeight = a4WidthPx / aspectRatio;
            if (pdfHeight > a4HeightPx) {
              pdfHeight = a4HeightPx;
              pdfWidth = a4HeightPx * aspectRatio;
            }
          } else {
            pdfHeight = a4HeightPx;
            pdfWidth = a4HeightPx * aspectRatio;
            if (pdfWidth > a4WidthPx) {
              pdfWidth = a4WidthPx;
              pdfHeight = a4WidthPx / aspectRatio;
            }
          }

          const pdf = new jsPDF({
            orientation: viewportWidth > viewportHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [pdfWidth, pdfHeight],
          });
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`${fileName}.pdf`);
        } else if (exportFormat === 'pptx') {
          const imgData = canvas.toDataURL('image/png');
          const pptx = new PptxGenJS();
          const slide = pptx.addSlide();
          const aspectRatio = viewportWidth / viewportHeight;
          const slideWidth = 10;
          let slideHeight = slideWidth / aspectRatio;
          if (slideHeight > 7.5) {
            slideHeight = 7.5;
            slideWidth = slideHeight * aspectRatio;
          }
          slide.addImage({
            data: imgData,
            x: (10 - slideWidth) / 2,
            y: 0.5,
            w: slideWidth,
            h: slideHeight,
          });
          slide.addText(mapName, { x: 0, y: 0.2, fontSize: 18, color: '000000' });
          await pptx.writeFile({ fileName });
        }
      } else if (exportFormat === 'docx') {
        const doc = new Document({
          sections: [{
            children: [
              new Paragraph({
                text: `Mapa Mental: ${mapName}`,
                heading: 'Title'
              }),
              new Table({
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph('ID')] }),
                      new TableCell({ children: [new Paragraph('Label')] }),
                      new TableCell({ children: [new Paragraph('Color')] }),
                      new TableCell({ children: [new Paragraph('Position')] })
                    ]
                  }),
                  ...nodes.map(node => new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(node.id)] }),
                      new TableCell({ children: [new Paragraph(node.data.label)] }),
                      new TableCell({ children: [new Paragraph(node.data.color)] }),
                      new TableCell({ children: [new Paragraph(`x: ${node.position.x}, y: ${node.position.y}`)] })
                    ]
                  })),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph('Edges:')] }),
                      new TableCell({ children: [new Paragraph('')] }),
                      new TableCell({ children: [new Paragraph('')] }),
                      new TableCell({ children: [new Paragraph('')] })
                    ]
                  }),
                  ...edges.map(edge => new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(edge.id)] }),
                      new TableCell({ children: [new Paragraph(`Source: ${edge.source}`)] }),
                      new TableCell({ children: [new Paragraph(`Target: ${edge.target}`)] }),
                      new TableCell({ children: [new Paragraph('')] })
                    ]
                  }))
                ],
                width: { size: 100, type: WidthType.PERCENTAGE }
              })
            ]
          }]
        });
        const buffer = await Packer.toBlob(doc);
        saveAs(buffer, `${fileName}.docx`);
      } else if (exportFormat === 'xlsx') {
        const csvContent = [
          ['Nodes'],
          ['ID', 'Label', 'Color', 'Position X', 'Position Y'],
          ...nodes.map(node => [node.id, node.data.label, node.data.color, node.position.x, node.position.y]),
          [''],
          ['Edges'],
          ['ID', 'Source', 'Target'],
          ...edges.map(edge => [edge.id, edge.source, edge.target])
        ].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        saveAs(blob, `${fileName}.csv`);
      } else if (exportFormat === 'json') {
        const mapData = JSON.stringify({ nodes: syncedNodes, edges, palettes, name: mapName }, null, 2);
        const blob = new Blob([mapData], { type: 'application/json' });
        saveAs(blob, `${fileName}.json`);
      } else if (exportFormat === 'txt') {
        const txtContent = [
          `Mapa Mental: ${mapName}`,
          '',
          'Nós:',
          ...nodes.map(node => `ID: ${node.id}, Label: ${node.data.label}, Color: ${node.data.color}, Position: (${node.position.x}, ${node.position.y})`),
          '',
          'Bordas:',
          ...edges.map(edge => `ID: ${edge.id}, Source: ${edge.source}, Target: ${edge.target}`)
        ].join('\n');
        const blob = new Blob([txtContent], { type: 'text/plain' });
        saveAs(blob, `${fileName}.txt`);
      }
      alert(`Mapa exportado como ${exportFormat.toUpperCase()} com sucesso!`);
    } catch (err) {
      console.error('Erro ao exportar mapa:', err);
      setError(`Erro ao exportar mapa como ${exportFormat.toUpperCase()}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [isLocked, mapName, syncedNodes, edges, palettes, exportFormat, theme, getMapBounds]);

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

  const toggleFeed = useCallback(() => {
    setShowFeed((prev) => !prev);
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
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        onInit={setReactFlowInstance => (reactFlowInstance.current = setReactFlowInstance)}
        fitView={false}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
      >
        <Background />
        <Controls onInteractiveChange={handleInteractiveChange} />
        {!isDragging && <MiniMap />}
      </ReactFlow>

      <div className="controls">
        <button onClick={toggleFeed} className="menu-button" disabled={loading}>
          <FiMenu />
        </button>
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
        <div className="export-container">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            disabled={loading || isLocked}
            className="export-format-selector"
          >
            <option value="png">Imagem (PNG)</option>
            <option value="jpg">Imagem (JPG)</option>
            <option value="pdf">PDF</option>
            <option value="pptx">PowerPoint (PPTX)</option>
            <option value="docx">Word (DOCX)</option>
            <option value="xlsx">Excel (CSV)</option>
            <option value="json">JSON</option>
            <option value="txt">Texto (TXT)</option>
          </select>
          <button onClick={exportMap} disabled={loading || isLocked}>Exportar Mapa</button>
        </div>
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

      {showFeed && (
        <MapFeed
          maps={maps}
          loadMap={loadMap}
          closeFeed={toggleFeed}
          theme={theme}
          isLocked={isLocked}
        />
      )}

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