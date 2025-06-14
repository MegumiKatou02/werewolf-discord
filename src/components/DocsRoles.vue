<template>
  <div class="roles-container">
    <h1 class="roles-title">Các vai trò cơ bản</h1>
    <div class="roles-grid">
      <div v-for="role in paginatedRoles" :key="role.name" class="role-card">
        <img :src="role.image" :alt="role.name" class="role-image">
        <div class="role-content">
          <h3>{{ role.name }}</h3>
          <p>{{ role.description }}</p>
        </div>
      </div>
    </div>
    
    <div class="pagination">
      <button 
        :disabled="currentPage === 1" 
        @click="currentPage--" 
        class="pagination-btn"
      >
        Trang trước
      </button>
      <span class="page-info">Trang {{ currentPage }} / {{ totalPages }}</span>
      <button 
        :disabled="currentPage === totalPages" 
        @click="currentPage++" 
        class="pagination-btn"
      >
        Trang sau
      </button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      currentPage: 1,
      itemsPerPage: 6,
      roles: [
        {
          name: 'Dân làng',
          description: 'Tìm và loại bỏ Ma Sói',
          image: new URL('@/assets/villager.png', import.meta.url).href
        },
        {
          name: 'Ma Sói',
          description: 'Ẩn mình, loại bỏ dân làng vào ban đêm',
          image: new URL('@/assets/werewolf.png', import.meta.url).href
        },
        {
          name: 'Tiên Tri',
          description: 'Mỗi đêm bạn có thể xem phe của người chơi khác',
          image: new URL('@/assets/seer.png', import.meta.url).href
        },
        {
          name: 'Bảo Vệ',
          description: 'Bạn có thể chọn một người chơi để bảo vệ mỗi đêm. Người được bảo vệ không thể bị giết vào đêm đó, thay vào đó bạn sẽ bị tấn công thay họ. Vì bạn rất khỏe nên sẽ không thể bị chết trong lần tấn công đầu tiên nhưng sẽ chết trong lần tấn công thứ hai. Mỗi đêm bạn sẽ tự bảo vệ chính mình',
          image: new URL('@/assets/bodyguard.png', import.meta.url).href
        },
        {
          name: 'Xạ Thủ',
          description: 'Bạn có hai viên đạn mà bạn có thể sử dụng để bắn ai đó. Bạn chỉ bắn được một viên đạn mỗi ngày. Vì âm thanh tiếng súng khi bắn rất lớn nên vai trò của bạn sẽ được tiết lộ sau lần bắn đầu tiên. Bạn không thể bắn trong giai đoạn thảo luận vào ngày đầu tiên',
          image: new URL('@/assets/gunner.png', import.meta.url).href
        },
        {
          name: 'Phù thủy',
          description: 'Bạn có hai bình thuốc: Một bình dùng để giết và bình kia để bảo vệ người chơi. Bình bảo vệ chỉ được tiêu thụ nếu người chơi đó bị tấn công. Bạn không thể giết trong đêm đầu tiên',
          image: new URL('@/assets/witch.png', import.meta.url).href
        },
        {
          name: 'Sói Trùm',
          description: 'Che các sói khỏi tiên tri, mỗi đêm 1 sói, được phép che liên tục một sói',
          image: new URL('@/assets/alpha_werewolf.png', import.meta.url).href
        },
        {
          name: 'Sói Tiên Tri',
          description: 'Soi xem ai là tiên tri. Không được tham gia cùng sói, biết sói là ai và ngược lại, sói tiên tri soi xong thì quản trò sẽ báo cho sói biết là sói tiên tri soi ai',
          image: new URL('@/assets/wolf_seer.png', import.meta.url).href
        },
        {
          name: 'Thầy Đồng',
          description: 'Vào buổi đêm bạn có thể trò chuyện ẩn danh với người chết. Bạn có khả năng chọn một dân làng đã chết trong đêm và hồi sinh họ khi đêm kết thúc một lần trong ván đấu',
          image: new URL('@/assets/medium.png', import.meta.url).href
        },
        {
          name: 'Thám tử',
          description: 'Mỗi đêm có thể điều tra phe giữa hai người chơi',
          image: new URL('@/assets/detective.png', import.meta.url).href
        },
        {
          name: 'Cáo/Hồ ly',
          description: 'Mỗi đêm dậy soi 3 người tự chọn trong danh sách, nếu 1 trong 3 người đó là sói thì được báo "Có sói", nếu đoán hụt thì mất chức năng',
          image: new URL('@/assets/fox_spirit.png', import.meta.url).href
        },
        {
          name: 'Lycan',
          description: 'Là dân, bị soi thì quản trò bảo tiên tri là phe sói; bị thám tử soi với dân thì khác phe, soi với sói thì cùng phe; Nhưng bạn vẫn là dân, mãi mãi là dân...',
          image: new URL('@/assets/lycan.png', import.meta.url).href
        },
        {
          name: 'Hầu Gái',
          description: 'Bạn được chọn 1 người làm chủ, chủ chết thì người đó lên thay và quản trò báo cho cả làng là hầu gái lên vai gì',
          image: new URL('@/assets/maid.png', import.meta.url).href
        },
        {
          name: 'Già Làng',
          description: 'Sói phải cắn 2 lần thì Già làng mới chết. Già Làng chỉ chết ngay lập tức nếu bị cả làng treo cổ, Phù Thủy bỏ độc... Khi Già làng chết thì tất cả những người phe dân làng đều mất khả năng đặc biệt cho đến hết ván',
          image: new URL('@/assets/elder.png', import.meta.url).href
        },
        {
          name: 'Thằng Ngố',
          description: 'Bạn phải lừa dân làng treo cổ bạn. Nếu họ treo cổ bạn, bạn thắng',
          image: new URL('@/assets/fool.png', import.meta.url).href
        },
        {
          name: 'Bán Sói',
          description: 'Là dân làng nhưng sẽ trở thành sói nếu bị sói cắn',
          image: new URL('@/assets/cursed.png', import.meta.url).href
        }
      ]
    }
  },
  computed: {
    paginatedRoles() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.roles.slice(start, end);
    },
    totalPages() {
      return Math.ceil(this.roles.length / this.itemsPerPage);
    }
  }
}
</script>

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
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
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

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  gap: 1rem;
}

.pagination-btn {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.pagination-btn:hover:not(:disabled) {
  background-color: #45a049;
}

.pagination-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.page-info {
  font-size: 1rem;
  color: #666;
}
</style> 