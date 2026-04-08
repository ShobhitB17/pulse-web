import axios from 'axios'

const base = import.meta.env.VITE_API_URL

const api = {
  async getEntries(token) {
    const res = await axios.get(`${base}/entries`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data
  },

  async saveEntry(token, data) {
    const res = await axios.post(`${base}/entries`, data, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data
  },

  async deleteEntry(token, id) {
    await axios.delete(`${base}/entries/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  },

  async deleteLastEntry(token) {
    await axios.delete(`${base}/entries/last/one`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  },

  async deleteAllEntries(token) {
    await axios.delete(`${base}/entries/all/clear`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  },

  async updateEntry(token, data) {
    const res = await axios.put(`${base}/entries/${data.id}`, data, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data
  },

  async getAiInsights(token) {
    const res = await axios.get(`${base}/ai/insights`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data
  },

  async generateAiInsight(token, { entries, range }) {
    const res = await axios.post(`${base}/ai/insights`, { entries, range }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data
  },

  async getTriggerClusters(token) {
    const res = await axios.get(`${base}/ai/clusters`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data
  },

  async generateTriggerClusters(token, { entries, range }) {
    const res = await axios.post(`${base}/ai/clusters`, { entries, range }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data
  }
}

export default api