import { ref, watch, onMounted, onUnmounted, isRef } from 'vue'

/**
 * 轮询拉取一个 /api/* 接口。path 可以是字符串，也可以是 ref/computed（变化时自动重拉）。
 * - 失败时 data 保持 null，前端显示“暂无数据”，不抛错、不刷屏。
 * - intervalMs 到期自动刷新；返回手动 refresh。
 */
export function useApi(pathOrRef, intervalMs = 60000) {
  const getPath = () => (isRef(pathOrRef) ? pathOrRef.value : pathOrRef)
  const data = ref(null)
  const loading = ref(true)
  const error = ref('')
  let timer = null

  async function load() {
    const p = getPath()
    if (!p) { loading.value = false; return }
    try {
      const res = await fetch(p)
      const json = await res.json()
      if (json && json.ok) {
        data.value = json.data
        error.value = ''
      } else {
        error.value = (json && json.error) || '接口返回异常'
      }
    } catch (e) {
      error.value = '网络异常'
    } finally {
      loading.value = false
    }
  }

  if (isRef(pathOrRef)) watch(pathOrRef, () => { loading.value = true; load() })

  onMounted(() => {
    load()
    if (intervalMs > 0) timer = setInterval(load, intervalMs)
  })
  onUnmounted(() => { if (timer) clearInterval(timer) })

  return { data, loading, error, refresh: load }
}

export function fmtNum(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US')
}

export function fmtMoney(n, digits = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function fmtUptime(sec) {
  if (sec == null) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

export const WEATHER_TEXT = {
  0: '晴', 1: '多云', 2: '多云', 3: '阴',
  45: '雾', 48: '雾凇', 51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪',
  80: '阵雨', 81: '阵雨', 82: '暴雨', 95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '雷阵雨伴冰雹'
}
export function weatherText(code) { return WEATHER_TEXT[code] ?? '未知' }
