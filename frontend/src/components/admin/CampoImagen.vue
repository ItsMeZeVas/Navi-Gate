<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../lib/api'

// Campo de imagen reutilizable: sube el archivo con el mismo sistema de
// fotos del resto del panel y entrega la URL resultante vía v-model.
defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const auth = useAuthStore()
const subiendo = ref(false)
const error = ref('')

async function alElegir(evento) {
  const archivo = evento.target.files?.[0]
  evento.target.value = ''
  if (!archivo) return
  subiendo.value = true
  error.value = ''
  try {
    const url = await api.subirFoto(archivo, auth.token)
    emit('update:modelValue', url)
  } catch (err) {
    error.value = err.message
  } finally {
    subiendo.value = false
  }
}
</script>

<template>
  <div class="campo-imagen">
    <img v-if="modelValue" :src="modelValue" alt="Vista previa de la imagen" class="vista-previa" />
    <div class="botones">
      <label class="btn-archivo" :class="{ 'btn-archivo--ocupado': subiendo }">
        {{ subiendo ? 'Subiendo…' : modelValue ? 'Cambiar imagen' : 'Subir imagen (opcional)' }}
        <input type="file" accept="image/*" :disabled="subiendo" @change="alElegir" />
      </label>
      <button v-if="modelValue" type="button" class="btn-quitar" @click="emit('update:modelValue', '')">
        Quitar
      </button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.campo-imagen {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.vista-previa {
  width: 100%;
  max-width: 260px;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.botones {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.btn-archivo {
  display: inline-block;
  padding: 0.45rem 0.8rem;
  background: var(--ng-accent-light);
  color: var(--ng-navy);
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-archivo--ocupado {
  opacity: 0.6;
  cursor: progress;
}

.btn-archivo input {
  display: none;
}

.btn-quitar {
  background: none;
  border: none;
  color: var(--ng-danger);
  font-size: 0.82rem;
  cursor: pointer;
}

.error {
  color: var(--ng-danger);
  font-size: 0.8rem;
}
</style>
