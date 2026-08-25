<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { api } from '../lib/api'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const error = ref('')

onMounted(async () => {
  try {
    const qr = await api.getQr(route.params.slug)
    session.setQr(qr.slug, qr.nombre)
    router.replace('/app/inicio')
  } catch (err) {
    error.value = err.message
  }
})
</script>

<template>
  <div class="pagina">
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else class="cargando">Ubicando tu punto de partida…</p>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  text-align: center;
}

.cargando {
  color: var(--ng-ink-soft);
}

.error {
  color: var(--ng-danger);
}
</style>
