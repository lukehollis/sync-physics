import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DeckGL } from '@deck.gl/react';
import { LineLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl';
import { Text } from '@geist-ui/core';
import config from '../config.js';
import 'mapbox-gl/dist/mapbox-gl.css';

const WS_URL = `${config.WS_BASE_URL}/ws/marl`;
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const INITIAL_VIEW_STATE = {
    longitude: -74.0060,
    latitude: 40.7128,
    zoom: 14,
    pitch: 45,
    bearing: 0
};

export default function DriveGraph() {
    const [agents, setAgents] = useState([]);
    const [error, setError] = useState(null);
    const wsRef = useRef(null);
    const viewStateRef = useRef(INITIAL_VIEW_STATE);

    const connect = useCallback(() => {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('MARL WS opened');
            sendBounds();
        };

        ws.onmessage = (ev) => {
            try {
                const parsed = JSON.parse(ev.data);

                if (parsed.type === 'error') {
                    setError(parsed.message);
                    console.error(`ERROR: ${parsed.message}`);
                    return;
                }

                if (parsed.type === 'update') {
                    const agentArray = Object.values(parsed.agents);
                    setAgents(agentArray);
                }
            } catch (e) {
                console.error("Failed to process message: ", e);
            }
        };

        ws.onclose = () => {
            console.log('MARL WS closed');
        };
        
        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            setError("WebSocket connection failed. Please check the server.");
        }

    }, []);

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);
    
    const sendBounds = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const { longitude, latitude, zoom } = viewStateRef.current;
            
            // A rough approximation of bounds from viewport
            const lngDiff = 360 / Math.pow(2, zoom);
            const latDiff = lngDiff / 2;

            const bounds = {
                minLng: longitude - lngDiff / 2,
                maxLng: longitude + lngDiff / 2,
                minLat: latitude - latDiff / 2,
                maxLat: latitude + latDiff / 2
            };

            wsRef.current.send(JSON.stringify({ type: 'start', bounds }));
        }
    }
    
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    const debouncedSendBounds = useCallback(debounce(sendBounds, 1000), []);

    const onViewStateChange = ({ viewState }) => {
        viewStateRef.current = viewState;
        debouncedSendBounds();
    };

    const layers = useMemo(() => {
        if (!agents.length) return [];

        const agentPoints = new ScatterplotLayer({
            id: 'agent-points',
            data: agents,
            getPosition: d => [d.position[1], d.position[0]],
            getFillColor: [255, 140, 0],
            getRadius: 20,
            radiusMinPixels: 2,
            radiusMaxPixels: 20,
        });
        
        const agentPaths = new LineLayer({
            id: 'agent-paths',
            data: agents.filter(a => a.path && a.path.length > 1),
            getPath: d => d.path.map(p => [p[1], p[0]]),
            getColor: [0, 255, 0, 100],
            getWidth: 3,
            widthMinPixels: 1,
        });

        return [agentPaths, agentPoints];
    }, [agents]);

    if (error) {
        return (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#110000', color: '#ffaaaa' }}>
                <Text h2>Error Connecting to Simulation</Text>
                <Text p>{error}</Text>
            </div>
        );
    }

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000011' }}>
            <DeckGL
                initialViewState={INITIAL_VIEW_STATE}
                controller={true}
                layers={layers}
                onViewStateChange={onViewStateChange}
            >
                <Map
                    mapboxAccessToken={MAPBOX_TOKEN}
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                />
            </DeckGL>

            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1, color: '#fff' }}>
                <Text h1 style={{ margin: '12px 0', color: '#fff', fontSize: '2rem' }}>
                  DriveGraph MARL
                </Text>
            </div>
        </div>
    );
}
