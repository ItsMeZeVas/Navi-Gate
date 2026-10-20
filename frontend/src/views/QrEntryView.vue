<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { api } from '../lib/api'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const error = ref('')
const tardando = ref(false)

onMounted(async () => {
  // En el plan gratuito del hosting, el servidor se duerme tras un rato sin
  // visitas y la primera petición tarda cerca de un minuto en despertarlo.
  const aviso = setTimeout(() => {
    tardando.value = true
  }, 4000)

  try {
    const qr = await api.getQr(route.params.slug)
    session.setQr(qr.slug, qr.nombre)
    router.replace('/app/inicio')
  } catch (err) {
    error.value = err.message
  } finally {
    clearTimeout(aviso)
  }
})
</script>

<template>
  <div class="pagina">
    <p v-if="error" class="error">{{ error }}</p>
    <div v-else class="cargando">
      <p>Ubicando tu punto de partida…</p>
      <p v-if="tardando" class="aviso">
        El servidor estaba descansando y está despertando. Puede tardar hasta un minuto la primera vez; no cierres
        esta pantalla.
      </p>
    </div>
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
  max-width: 320px;
}

.aviso {
  margin-top: 0.75rem;
  font-size: 0.82rem;
  line-height: 1.45;
}

.error {
  color: var(--ng-danger);
}
</style>
