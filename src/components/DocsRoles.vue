<template>
  <div class="roles-container">
    <h1 class="roles-title">Các vai trò cơ bản</h1>
    <div class="roles-grid">
      <div class="role-card">
        <img src="@/assets/villager.png" alt="Dân làng" class="role-image">
        <div class="role-content">
          <h3>Dân làng</h3>
          <p>Tìm và loại bỏ Ma Sói</p>
        </div>
      </div>

      <div class="role-card">
        <img src="@/assets/werewolf.png" alt="Ma Sói" class="role-image">
        <div class="role-content">
          <h3>Ma Sói</h3>
          <p>Ẩn mình, loại bỏ dân làng vào ban đêm</p>
        </div>
      </div>

      <div class="role-card">
        <img src="@/assets/seer.png" alt="Tiên tri" class="role-image">
        <div class="role-content">
          <h3>Tiên tri</h3>
          <p>Mỗi đêm kiểm tra vai trò một người</p>
        </div>
      </div>

      <div class="role-card">
        <img src="@/assets/bodyguard.png" alt="Bảo vệ" class="role-image">
        <div class="role-content">
          <h3>Bảo vệ</h3>
          <p>Bảo vệ một người khỏi bị sói cắn mỗi đêm</p>
        </div>
      </div>

      <div class="role-card">
        <img src="@/assets/gunner.png" alt="Thợ săn" class="role-image">
        <div class="role-content">
          <h3>Thợ săn</h3>
          <p>Khi bị loại có thể kéo theo một người khác</p>
        </div>
      </div>

      <div class="role-card">
        <img src="@/assets/witch.png" alt="Phù thủy" class="role-image">
        <div class="role-content">
          <h3>Phù thủy</h3>
          <p>Có thể cứu hoặc giết một người bằng thuốc</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.roles-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.roles-title {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 2rem;
  font-size: 2.5rem;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.role-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.role-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
}

.role-image {
  width: 100%;
  height: 200px;
  object-fit: contain;
  background: #f8f9fa;
  padding: 1rem;
}

.role-content {
  padding: 1.5rem;
}

.role-content h3 {
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}

.role-content p {
  color: #666;
  margin: 0;
  line-height: 1.5;
}
</style> 