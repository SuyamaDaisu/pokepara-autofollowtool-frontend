'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './page.module.css'

interface Status {
  is_running: boolean
  current_count: number
  target_count: number
}

export default function Home() {
  const [targetCount, setTargetCount] = useState<string>('')
  const [status, setStatus] = useState<Status>({
    is_running: false,
    current_count: 0,
    target_count: 0
  })
  const [error, setError] = useState<string>('')
  const [isConnected, setIsConnected] = useState(true)  // Start as true to enable buttons
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

  const API_BASE = 'http://160.251.171.205:8000'
  const WS_BASE = 'ws://160.251.171.205:8000'
  // const API_BASE = 'http://localhost:8000'
  // const WS_BASE = 'ws://localhost:8000'
  
  // WebSocket connection
  useEffect(() => {
    connectWebSocket()
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`${WS_BASE}/ws`)
      
      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setError('')
        // Request initial status
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('status')
          }
        }, 100)
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'update' || data.type === 'status') {
            setStatus({
              is_running: data.is_running,
              current_count: data.current_count,
              target_count: data.target_count
            })
          } else if (data.type === 'no_more_users') {
            // Show modal when there are no more users to follow
            setStatus({
              is_running: data.is_running,
              current_count: data.current_count,
              target_count: data.target_count
            })
            setModalMessage(data.message || 'これ以上フォローできる人がいません。')
            setShowModal(true)
          } else if (data.type === 'ping') {
            // Send pong back
            ws.send('pong')
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
        // Don't disable buttons on WebSocket error - REST API might still work
        console.warn('WebSocket disconnected, but buttons remain active for REST API')
      }
      
      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        // Keep buttons enabled - REST API still works
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            connectWebSocket()
          }
        }, 3000)
      }
      
      wsRef.current = ws
    } catch (err) {
      console.error('Failed to create WebSocket:', err)
      setIsConnected(false)
      setError('バックエンドへの接続に失敗しました')
    }
  }

  const handleStart = async () => {
    setError('')
    const count = parseInt(targetCount)
    
    if (isNaN(count) || count <= 0) {
      setError('０より大きい有効な数字を入力してください。')
      return
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_count: count })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to start')
      }
      
      const data = await response.json()
      console.log('Started:', data)
      
      // Immediately update status to enable Stop button
      setStatus({
        is_running: true,
        current_count: 0,
        target_count: count
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start process')
    }
  }

  const handleStop = async () => {
    setError('')
    
    try {
      const response = await fetch(`${API_BASE}/api/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to stop')
      }
      
      const data = await response.json()
      console.log('Stopped:', data)
      
      // Immediately update status to disable Stop button
      setStatus(prev => ({
        ...prev,
        is_running: false
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop process')
    }
  }

  const progress = status.target_count > 0 
    ? (status.current_count / status.target_count) * 100 
    : 0

  return (
    <main className={styles.main}>
      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>通知</h2>
              <button 
                className={styles.modalClose}
                onClick={() => setShowModal(false)}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>{modalMessage}</p>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.modalButton}
                onClick={() => setShowModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className={styles.container}>
        <h1 className={styles.title}>自動フォローツール</h1>
        
        <div className={styles.connectionStatus}>
          <div className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`}></div>
          <span>{isConnected ? '接続済み' : '切断'}</span>
        </div>

        <div className={styles.card}>
          <div className={styles.inputGroup}>
            <label htmlFor="targetCount" className={styles.label}>
              目標フォロー数
            </label>
            <input
              id="targetCount"
              type="number"
              className={styles.input}
              placeholder="フォロー数を入力"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              disabled={status.is_running}
              min="1"
            />
          </div>

          <div className={styles.buttonGroup}>
            <button
              className={`${styles.button} ${styles.startButton}`}
              onClick={handleStart}
              disabled={status.is_running}
            >
              開始
            </button>
            <button
              className={`${styles.button} ${styles.stopButton}`}
              onClick={handleStop}
              disabled={!status.is_running}
            >
              停止
            </button>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
        </div>

        <div className={styles.statusCard}>
          <h2 className={styles.statusTitle}>現在のステータス</h2>
          
          <div className={styles.statusInfo}>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>状態：</span>
              <span className={`${styles.statusValue} ${status.is_running ? styles.running : styles.idle}`}>
                {status.is_running ? '実行中' : '待機中'}
              </span>
            </div>
            
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>進捗：</span>
              <span className={styles.statusValue}>
                {status.current_count} / {status.target_count}
              </span>
            </div>
          </div>

          {status.target_count > 0 && (
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBar}
                style={{ width: `${progress}%` }}
              >
                <span className={styles.progressText}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          )}

          <div className={styles.countDisplay}>
            <div className={styles.countNumber}>
              {status.current_count}
            </div>
            <div className={styles.countLabel}>
              完了フォロー数
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

