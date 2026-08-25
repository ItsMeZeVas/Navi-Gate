<script setup></script>

<template>
  <div class="pagina">
    <span class="marca">NAVI-GATE</span>
    <p>Escanea un código QR del campus para empezar a buscar tu destino.</p>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  padding: 1.5rem;
}

.marca {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 2rem;
  letter-spacing: 0.05em;
  color: var(--ng-navy);
}

p {
  color: var(--ng-ink-soft);
  max-width: 320px;
}
</style>
