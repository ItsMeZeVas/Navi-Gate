import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      // Landing del QR: guarda el origen y redirige a /app/inicio
      path: '/qr/:slug',
      name: 'qr-entry',
      component: () => import('../views/QrEntryView.vue'),
    },
    {
      path: '/app',
      component: () => import('../views/AppShell.vue'),
      children: [
        { path: '', redirect: 'inicio' },
        { path: 'inicio', name: 'app-inicio', component: () => import('../views/InicioView.vue') },
        { path: 'buscar', name: 'app-buscar', component: () => import('../views/BuscarView.vue') },
        { path: 'explorar', name: 'app-explorar', component: () => import('../views/ExplorarView.vue') },
        { path: 'categorias', name: 'app-categorias', component: () => import('../views/CategoriasView.vue') },
        {
          path: 'como-llegar/:espacioId',
          name: 'app-como-llegar',
          component: () => import('../views/ComoLlegarView.vue'),
        },
      ],
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/admin',
      name: 'admin-panel',
      component: () => import('../views/AdminPanelView.vue'),
      meta: { requiereAuth: true },
    },
  ],
})

// Guard: si la ruta requiere sesión y no hay token, mandamos al login.
router.beforeEach((to) => {
  if (to.meta.requiereAuth) {
    const auth = useAuthStore()
    if (!auth.token) {
      return { name: 'admin-login' }
    }
  }
})

export default router
