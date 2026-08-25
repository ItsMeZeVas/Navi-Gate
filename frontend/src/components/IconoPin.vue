<script setup>
defineProps({ size: { type: Number, default: 22 } })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor">
    <path
      d="M12 2C7.86 2 4.5 5.36 4.5 9.5c0 5.25 6.32 11.6 6.59 11.87a1.25 1.25 0 0 0 1.76 0C13.13 21.1 19.5 14.75 19.5 9.5 19.5 5.36 16.14 2 12 2Zm0 10.25a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z"
    />
  </svg>
</template>
