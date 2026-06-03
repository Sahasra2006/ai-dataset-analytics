import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import Card from '../components/Card'

export default function AIChat() {
  const { chatId } = useParams()
  const [searchParams] = useSearchParams()
  const datasetParam = searchParams.get('dataset')
  const navigate = useNavigate()

  const [datasets, setDatasets] = useState([])
  const [chats, setChats] = useState([])
  const [selectedDataset, setSelectedDataset] = useState(datasetParam || '')
  const [currentChat, setCurrentChat] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    api.get('/datasets').then((res) => setDatasets(res.data.datasets || []))
    api.get('/chat').then((res) => setChats(res.data.chats || []))
  }, [])

  useEffect(() => {
    if (datasetParam) setSelectedDataset(datasetParam)
  }, [datasetParam])

  useEffect(() => {
    if (chatId) {
      api.get(`/chat/${chatId}`).then((res) => {
        setCurrentChat(res.data)
        setSelectedDataset(res.data.dataset_id)
      })
    } else {
      setCurrentChat(null)
    }
  }, [chatId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentChat?.messages])

  const startNewChat = async () => {
    if (!selectedDataset) return alert('Select a dataset first')
    const ds = datasets.find((d) => d.id === selectedDataset)
    const { data } = await api.post('/chat', {
      dataset_id: selectedDataset,
      title: `Chat about ${ds?.name || 'dataset'}`,
    })
    setChats((prev) => [{ ...data, message_count: 0 }, ...prev])
    navigate(`/chat/${data.id}`)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!message.trim() || !currentChat) return

    setLoading(true)
    const userMsg = message.trim()
    setMessage('')

    setCurrentChat((prev) => ({
      ...prev,
      messages: [...(prev?.messages || []), { role: 'user', content: userMsg }],
    }))

    try {
      const { data } = await api.post(`/chat/${currentChat.id}/message`, { message: userMsg })
      setCurrentChat(data.chat)
      setChats((prev) =>
        prev.map((c) =>
          c.id === data.chat.id
            ? { ...c, updated_at: data.chat.updated_at, message_count: data.chat.messages.length }
            : c,
        ),
      )
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const deleteChat = async (id) => {
    if (!confirm('Delete this chat?')) return
    await api.delete(`/chat/${id}`)
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (currentChat?.id === id) {
      setCurrentChat(null)
      navigate('/chat')
    }
  }

  const quickPrompts = [
    'What is this dataset about?',
    'Explain the columns.',
    'Give me key insights.',
    'Summarize the dataset.',
  ]

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      <div className="flex w-72 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold text-slate-800">Chats</h2>
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select dataset</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={startNewChat}
            disabled={!selectedDataset}
            className="mt-2 w-full rounded-lg bg-primary-600 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
          >
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chats.length === 0 ? (
            <p className="p-2 text-xs text-slate-500">No previous chats</p>
          ) : (
            chats.map((c) => (
              <div
                key={c.id}
                className={`mb-1 flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  currentChat?.id === c.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50'
                }`}
              >
                <button
                  onClick={() => navigate(`/chat/${c.id}`)}
                  className="flex-1 truncate text-left"
                >
                  {c.title}
                </button>
                <button
                  onClick={() => deleteChat(c.id)}
                  className="ml-2 text-red-500 hover:text-red-700"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <Card className="flex flex-1 flex-col !p-0 overflow-hidden">
        {!currentChat ? (
          <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
            Select a dataset and start a new chat, or open a previous conversation.
          </div>
        ) : (
          <>
            <div className="border-b px-6 py-4">
              <h2 className="font-semibold text-slate-800">{currentChat.title}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {currentChat.messages?.length === 0 && (
                <p className="text-sm text-slate-500">Ask anything about your dataset. Try a quick prompt below.</p>
              )}
              {currentChat.messages?.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {currentChat.messages?.length === 0 && (
              <div className="flex flex-wrap gap-2 px-6 pb-2">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => setMessage(p)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={sendMessage} className="border-t p-4">
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about your dataset..."
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? '...' : 'Send'}
                </button>
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  )
}
