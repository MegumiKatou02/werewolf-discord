<template>
  <div class="docs-layout">
    <header>
      <div class="logo-title">
        <!-- <img src="/logo.svg" alt="Logo" class="logo" /> -->
        <span class="title">Werewolf Discord</span>
      </div>
      <a href="https://github.com/MegumiKatou02/werewolf-discord" target="_blank" class="github-link" title="GitHub">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05A9.38 9.38 0 0 1 12 6.84c.85.004 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" fill="#7c3aed"/></svg>
      </a>
    </header>
    <div class="main-area">
      <aside>
        <nav>
          <ul>
            <li :class="{active: current==='intro'}" @click="$emit('change','intro')"><span></span> Giới thiệu</li>
            <li :class="{active: current==='rules'}" @click="$emit('change','rules')"><span></span> Luật chơi</li>
            <li :class="{active: current==='roles'}" @click="$emit('change','roles')"><span></span> Các vai trò</li>
            <li :class="{active: current==='faq'}" @click="$emit('change','faq')"><span></span> FAQ</li>
            <li :class="{active: current==='contact'}" @click="$emit('change','contact')"><span></span> Liên hệ</li>
          </ul>
        </nav>
      </aside>
      <section class="docs-content">
        <slot />
      </section>
    </div>
    <footer>
      © 2025 Werewolf Discord
    </footer>
  </div>
</template>

<script setup>
const props = defineProps({
  current: String
})
</script>

<style scoped>
.docs-layout {
  min-height: 100vh;
  background: #f8f8fc;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1.5px solid #ececec;
  padding: 0 32px;
  height: 68px;
  box-shadow: 0 2px 8px rgba(124,58,237,0.04);
  z-index: 10;
}
.logo-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #f3e8ff;
  border: 1.5px solid #7c3aed22;
}
.title {
  font-size: 1.45rem;
  font-weight: 700;
  color: #7c3aed;
  letter-spacing: 1px;
}
.github-link {
  display: flex;
  align-items: center;
  opacity: 0.8;
  transition: opacity 0.2s;
}
.github-link:hover {
  opacity: 1;
}
.main-area {
  display: flex;
  flex: 1;
  min-height: 0;
}
aside {
  width: 240px;
  background: #fff;
  border-right: 1.5px solid #ececec;
  padding: 32px 0 32px 0;
  box-shadow: 2px 0 8px rgba(124,58,237,0.03);
}
nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
nav li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 36px;
  cursor: pointer;
  color: #444;
  font-weight: 500;
  border-left: 4px solid transparent;
  font-size: 1.08rem;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  border-radius: 0 20px 20px 0;
  margin-bottom: 4px;
}
nav li.active, nav li:hover {
  background: #f3e8ff;
  border-left: 4px solid #7c3aed;
  color: #7c3aed;
}
.docs-content {
  flex: 1;
  padding: 48px 40px 32px 40px;
  min-width: 0;
  background: #f8f8fc;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 2px 16px rgba(124,58,237,0.04);
  margin: 32px 32px 0 32px;
}
footer {
  text-align: center;
  color: #888;
  font-size: 0.98rem;
  padding: 18px 0 12px 0;
  background: none;
}
footer a {
  color: #7c3aed;
  text-decoration: none;
  font-weight: 500;
}
@media (max-width: 1000px) {
  aside {
    width: 100px;
    padding: 16px 0;
  }
  .docs-content {
    margin: 16px 8px 0 8px;
    padding: 24px 6px 16px 6px;
  }
}
@media (max-width: 700px) {
  .main-area {
    flex-direction: column;
  }
  aside {
    width: 100%;
    border-right: none;
    border-bottom: 1.5px solid #ececec;
    padding: 0;
    box-shadow: none;
  }
  .docs-content {
    margin: 0;
    border-radius: 0;
    padding: 16px 2px 8px 2px;
  }
  header {
    padding: 0 10px;
  }
}
</style> 