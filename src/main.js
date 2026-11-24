import { createApp } from 'vue'
import VueGridLayout from 'vue-grid-layout'
import App from './App.vue'
import './style.css'

const app = createApp(App)
// vue-grid-layout 3.0.0-beta1 的默认导出是一个 install 函数，
// 会全局注册 grid-layout / grid-item 两个组件。
app.use(VueGridLayout)
app.mount('#app')
