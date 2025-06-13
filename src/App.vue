<script setup>
import { ref } from 'vue'
import DocsLayout from './components/DocsLayout.vue'
import DocsIntro from './components/DocsIntro.vue'
import DocsRules from './components/DocsRules.vue'
import DocsRoles from './components/DocsRoles.vue'
import DocsFAQ from './components/DocsFAQ.vue'
import DocsContact from './components/DocsContact.vue'

const current = ref('intro')
</script>

<template>
  <DocsLayout :current="current" @change="val => current = val">
    <DocsIntro v-if="current==='intro'" />
    <DocsRules v-else-if="current==='rules'" />
    <DocsRoles v-else-if="current==='roles'" />
    <DocsFAQ v-else-if="current==='faq'" />
    <DocsContact v-else-if="current==='contact'" />
  </DocsLayout>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
body {
  background: #f8f8fc;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  color: #222;
}
</style>
