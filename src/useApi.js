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
  // 请求代际：每次 load() 发起都 +1，只有最新一次请求的结果才允许写回。
  // 否则会出现“旧请求后返回、覆盖新请求结果”的竞态——比如天气卡切城市时，
  // 旧城市那次慢请求晚于新城市请求返回，屏幕上就会挂着旧城市的数据
  // （之前用户切到北京后预警区还挂着烟台的海阳预警，就是这个原因）。
  let seq = 0

  async function load() {
    const p = getPath()
    if (!p) { loading.value = false; return }
    const mySeq = ++seq
    try {
      const res = await fetch(p)
      const json = await res.json()
      if (mySeq !== seq) return // 已有更新的请求在途，丢弃本次过期结果
      if (json && json.ok) {
        data.value = json.data
        error.value = ''
      } else {
        error.value = (json && json.error) || '接口返回异常'
      }
    } catch (e) {
      if (mySeq !== seq) return
      error.value = '网络异常'
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  // 路径变了 = 查的东西变了（比如天气卡换城市）：先清掉旧数据，绝不让
  // 旧城市的内容残留在屏幕上（哪怕新请求还没回来，也只显示“加载中…”）。
  // 定时刷新走 load() 本身，不清数据（同一路径刷新不闪屏）。
  if (isRef(pathOrRef)) watch(pathOrRef, () => {
    data.value = null
    error.value = ''
    loading.value = true
    load()
  })

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
