/**
 * Vegetable Patch Visualisation
 * Renders a growing vegetable patch based on progress towards goal
 */

class VegetablePatch {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.total = 0;
    this.goal = 100000;
    this.percentage = 0;
    
    // Vegetable types with their growth stages
    this.vegetables = [
      { type: 'carrot', color: '#FF9800', emoji: '🥕', rows: [0, 3] },
      { type: 'tomato', color: '#F44336', emoji: '🍅', rows: [1, 4] },
      { type: 'lettuce', color: '#4CAF50', emoji: '🥬', rows: [2, 5] }
    ];
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    const container = this.canvas.parentElement;
    const ratio = window.devicePixelRatio || 1;
    
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';
    
    const width = container.clientWidth - 64; // Account for padding
    const height = Math.min(400, width * 0.5);
    
    this.canvas.width = width * ratio;
    this.canvas.height = height * ratio;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    
    this.ctx.scale(ratio, ratio);
    this.width = width;
    this.height = height;
    
    this.render();
  }
  
  update(total, goal) {
    this.total = total;
    this.goal = goal;
    this.percentage = Math.min(100, (total / goal) * 100);
    this.render();
  }
  
  render() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.3);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.3);
    
    // Draw sun
    const sunSize = Math.max(15, Math.min(40, width * 0.05));
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(width - 60, 40, sunSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw sun rays
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(
        width - 60 + Math.cos(angle) * (sunSize + 5),
        40 + Math.sin(angle) * (sunSize + 5)
      );
      ctx.lineTo(
        width - 60 + Math.cos(angle) * (sunSize + 15),
        40 + Math.sin(angle) * (sunSize + 15)
      );
      ctx.stroke();
    }
    
    // Draw soil
    const soilGradient = ctx.createLinearGradient(0, height * 0.3, 0, height);
    soilGradient.addColorStop(0, '#8B4513');
    soilGradient.addColorStop(1, '#654321');
    ctx.fillStyle = soilGradient;
    ctx.fillRect(0, height * 0.3, width, height * 0.7);
    
    // Draw soil texture
    ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * width;
      const y = height * 0.3 + Math.random() * height * 0.7;
      ctx.fillRect(x, y, 2, 2);
    }
    
    // Calculate number of vegetables to show based on percentage
    const maxVegetables = 36; // 6 rows x 6 columns
    const vegetablesToShow = Math.floor((this.percentage / 100) * maxVegetables);
    
    // Draw garden rows and vegetables
    const rowHeight = (height * 0.6) / 6;
    const colWidth = width / 6;
    const soilTop = height * 0.3;
    
    let vegCount = 0;
    
    for (let row = 0; row < 6; row++) {
      const y = soilTop + (row * rowHeight) + rowHeight / 2;
      
      // Determine which vegetable type for this row
      const vegType = this.vegetables.find(v => v.rows.includes(row));
      
      for (let col = 0; col < 6; col++) {
        if (vegCount >= vegetablesToShow) break;
        
        const x = (col * colWidth) + colWidth / 2;
        
        // Calculate growth stage (0-1)
        const growthProgress = Math.min(1, (vegCount / vegetablesToShow) + 0.3);
        
        this.drawVegetable(x, y, vegType, growthProgress);
        vegCount++;
      }
    }
    
    // Draw watering can if growing
    if (this.percentage > 0 && this.percentage < 100) {
      this.drawWateringCan(width - 80, height * 0.5);
    }
    
    // Draw progress text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 4;
    const progressText = `${this.percentage.toFixed(1)}% Grown`;
    ctx.strokeText(progressText, width / 2, height - 20);
    ctx.fillText(progressText, width / 2, height - 20);
  }
  
  drawVegetable(x, y, vegType, growth) {
    const ctx = this.ctx;
    const size = Math.max(5, 30 * growth); // Ensure minimum size
    
    if (growth < 0.2) {
      // Seed stage - just soil mound
      ctx.fillStyle = '#654321';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, 5 * growth), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    
    // Draw vegetable based on type and growth
    ctx.save();
    ctx.translate(x, y);
    
    if (vegType.type === 'carrot') {
      // Carrot leaves
      ctx.fillStyle = '#4CAF50';
      for (let i = 0; i < 3; i++) {
        const angle = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(angle) * size * 0.3,
          Math.sin(angle) * size * 0.3 - size * 0.2,
          size * 0.2,
          size * 0.4 * growth,
          angle,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      
      // Carrot (partially underground)
      if (growth > 0.5) {
        ctx.fillStyle = vegType.color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size * 0.15, size * 0.3 * growth);
        ctx.lineTo(size * 0.15, size * 0.3 * growth);
        ctx.closePath();
        ctx.fill();
      }
      
    } else if (vegType.type === 'tomato') {
      // Tomato plant stem
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -size * growth);
      ctx.stroke();
      
      // Tomato leaves
      ctx.fillStyle = '#4CAF50';
      for (let i = 0; i < 2; i++) {
        const leafY = -size * growth * (0.3 + i * 0.3);
        ctx.beginPath();
        ctx.ellipse(-size * 0.2, leafY, size * 0.15, size * 0.25, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(size * 0.2, leafY, size * 0.15, size * 0.25, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Tomato fruit (when grown)
      if (growth > 0.6) {
        ctx.fillStyle = vegType.color;
        ctx.beginPath();
        ctx.arc(0, -size * growth * 0.7, Math.max(3, size * 0.25), 0, Math.PI * 2);
        ctx.fill();
      }
      
    } else if (vegType.type === 'lettuce') {
      // Lettuce leaves in a rosette
      ctx.fillStyle = vegType.color;
      const leafCount = Math.floor(growth * 8) + 3;
      for (let i = 0; i < leafCount; i++) {
        const angle = (Math.PI * 2 * i) / leafCount;
        const leafSize = size * (0.3 + Math.random() * 0.2) * growth;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, -size * 0.3 * growth, leafSize, leafSize * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    
    ctx.restore();
  }
  
  drawWateringCan(x, y) {
    const ctx = this.ctx;
    const size = 40;
    
    ctx.save();
    ctx.translate(x, y);
    
    // Can body
    ctx.fillStyle = '#78909C';
    ctx.fillRect(-size * 0.3, -size * 0.2, size * 0.6, size * 0.5);
    
    // Spout
    ctx.fillStyle = '#78909C';
    ctx.beginPath();
    ctx.moveTo(size * 0.3, 0);
    ctx.lineTo(size * 0.6, -size * 0.3);
    ctx.lineTo(size * 0.6, -size * 0.2);
    ctx.lineTo(size * 0.35, 0.05);
    ctx.closePath();
    ctx.fill();
    
    // Handle
    ctx.strokeStyle = '#78909C';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-size * 0.2, 0, size * 0.25, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();
    
    // Water drops
    ctx.fillStyle = '#64B5F6';
    for (let i = 0; i < 3; i++) {
      const dropX = size * 0.6 + i * 5;
      const dropY = -size * 0.2 + i * 8;
      ctx.beginPath();
      ctx.arc(dropX, dropY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// Initialize the vegetable patch
let vegPatch;
document.addEventListener('DOMContentLoaded', () => {
  vegPatch = new VegetablePatch('vegPatchCanvas');
});
