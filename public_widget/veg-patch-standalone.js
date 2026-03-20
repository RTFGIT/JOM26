/**
 * Vegetable Patch Visualisation with PNG Assets
 * Renders a growing vegetable patch based on progress towards goal
 */

class VegetablePatch {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.total = 0;
    this.goal = 100000;
    this.percentage = 0;
    
    this.displayPercentage = 0;
    this.animationId = null;
    
    this.images = {};
    this.imagesLoaded = 0;
    this.totalImages = 9;
    this.loadImages();
    
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.animationQueue = [];
    this.isAnimating = false;
    this.currentAnimation = null;
    this.animationFrame = 0;
    
    this.pledgeQueue = [];
    
    window.addEventListener('message', (event) => {
      if (event.data.type === 'PLEDGE_SUBMITTED') {
        this.queuePledgeAnimation(event.data.tokens);
      }
    });

    window.onVegPatchUpdate = ({ total, goal, percent, tokensAdded, isUpdate }) => {
      this.total = total;
      this.goal = goal;
      this.percentage = percent;
      
      if (isUpdate && tokensAdded > 0) {
        this.queuePledgeAnimation(tokensAdded);
      } else if (!this.isAnimating) {
        this.update(total, goal);
      }
    };
  }
  
  loadImages() {
    const imageFiles = {
      seed1: 'Seed_01.png',
      seed2: 'Seed_02.png', 
      seed3: 'Seed_03.png',
      potato: 'Potato_01.png',
      tomato: 'Tomato_01.png',
      carrot: 'Carrot_01.png',
      wateringCan: 'Watering_Can_01.png',
      foodPlate: 'Food_plate_01.png'
    };
    
    Object.entries(imageFiles).forEach(([key, filename]) => {
      const img = new Image();
      img.onload = () => {
        this.imagesLoaded++;
        if (this.imagesLoaded >= this.totalImages) {
          this.render();
        }
      };
      img.onerror = () => {
        this.imagesLoaded++;
        console.warn('[JOM26] Failed to load:', filename);
      };
      img.src = `./assets/${filename}`;
      this.images[key] = img;
    });
  }
  
  queuePledgeAnimation(tokens) {
    this.pledgeQueue.push({ tokens, timestamp: Date.now() });
    this.processQueue();
  }
  
  processQueue() {
    if (this.isAnimating || this.pledgeQueue.length === 0) return;
    
    const pledge = this.pledgeQueue.shift();
    this.playSeedAnimation(pledge.tokens);
  }
  
  playSeedAnimation(tokens) {
    this.isAnimating = true;
    this.currentAnimation = 'seed';
    this.animationFrame = 0;
    this.pendingTokens = tokens;
    
    this.animateSeedFall();
  }
  
  animateSeedFall() {
    if (this.currentAnimation !== 'seed') return;
    
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    this.animationFrame += 0.03;
    
    if (this.animationFrame < 1) {
      this.render();
      
      const seedX = width * 0.3 + Math.sin(this.animationFrame * 10) * 20;
      const seedY = height * 0.1 + this.animationFrame * height * 0.2;
      
      const seedImg = this.images[`seed${Math.floor((this.animationFrame * 3) % 3) + 1}`];
      if (seedImg && seedImg.complete) {
        ctx.drawImage(seedImg, seedX - 15, seedY - 15, 30, 30);
      }
      
      requestAnimationFrame(() => this.animateSeedFall());
    } else if (this.animationFrame < 2) {
      this.render();
      this.drawSoilMounds();
      requestAnimationFrame(() => this.animateSeedPlant());
    } else {
      this.isAnimating = false;
      this.currentAnimation = null;
      this.total += this.pendingTokens;
      this.update(this.total, this.goal);
      this.processQueue();
    }
  }
  
  animateSeedPlant() {
    if (this.currentAnimation !== 'seed') return;
    
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    this.animationFrame += 0.02;
    
    if (this.animationFrame < 2.5) {
      this.render();
      this.drawSoilMounds();
      
      const progress = this.animationFrame - 1;
      const seedX = width * 0.3;
      const seedY = height * 0.3 - progress * 20;
      
      if (seedY > height * 0.3) {
        const seedImg = this.images.seed1;
        if (seedImg && seedImg.complete) {
          ctx.drawImage(seedImg, width * 0.3 - 15, height * 0.3 - 15, 30, 30);
        }
      }
      
      requestAnimationFrame(() => this.animateSeedPlant());
    } else if (this.animationFrame < 3.5) {
      this.render();
      this.drawSoilMounds();
      this.drawSeedsInSoil();
      requestAnimationFrame(() => this.animateWatering());
    }
  }
  
  animateWatering() {
    if (this.currentAnimation !== 'seed') return;
    
    const width = this.width;
    const height = this.height;
    
    this.animationFrame += 0.015;
    
    if (this.animationFrame < 4.5) {
      this.render();
      this.drawSoilMounds();
      this.drawSeedsInSoil();
      
      const progress = this.animationFrame - 3.5;
      const canX = width * 0.7 - progress * 100;
      const canY = height * 0.15 + Math.sin(progress * 5) * 5;
      
      this.drawWateringCan(canX, canY, progress < 0.5 ? 0.3 : 0);
      
      requestAnimationFrame(() => this.animateWatering());
    } else {
      this.isAnimating = false;
      this.currentAnimation = null;
      this.total += this.pendingTokens;
      this.update(this.total, this.goal);
      this.processQueue();
    }
  }
  
  resize() {
    const container = this.canvas.parentElement;
    const ratio = window.devicePixelRatio || 1;
    
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';
    
    const width = container.clientWidth - 64;
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
    
    if (!this.isAnimating) {
      this.animateGrowth();
    }
  }
  
  animateGrowth() {
    const diff = this.percentage - this.displayPercentage;
    
    if (Math.abs(diff) > 0.1) {
      const step = diff > 0 ? Math.max(0.5, Math.abs(diff) * 0.1) : -0.5;
      this.displayPercentage += step;
      
      if (this.displayPercentage < 0) this.displayPercentage = 0;
      if (this.displayPercentage > this.percentage) this.displayPercentage = this.percentage;
      
      this.render();
      this.animationId = requestAnimationFrame(() => this.animateGrowth());
    } else {
      this.displayPercentage = this.percentage;
      this.animationId = null;
      this.render();
    }
  }
  
  render() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    ctx.clearRect(0, 0, width, height);
    
    this.drawSky();
    this.drawSun();
    this.drawSoil();
    
    if (this.displayPercentage >= 100) {
      this.drawFoodPlated();
    } else {
      this.drawGrowingVegetables();
      
      if (this.displayPercentage > 0 && this.displayPercentage < 100) {
        this.drawWateringCan(width - 80, height * 0.5, 0);
      }
    }
    
    this.drawProgressText();
  }
  
  drawSky() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.35);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height * 0.35);
  }
  
  drawSun() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    const sunSize = Math.max(15, Math.min(40, width * 0.05));
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(width - 60, 40, sunSize, 0, Math.PI * 2);
    ctx.fill();
    
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
  }
  
  drawSoil() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    const soilGradient = ctx.createLinearGradient(0, height * 0.3, 0, height);
    soilGradient.addColorStop(0, '#8B4513');
    soilGradient.addColorStop(1, '#654321');
    ctx.fillStyle = soilGradient;
    ctx.fillRect(0, height * 0.3, width, height * 0.7);
    
    ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = height * 0.3 + Math.random() * height * 0.7;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  
  drawSoilMounds() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    const soilTop = height * 0.3;
    
    ctx.fillStyle = '#654321';
    for (let i = 0; i < 6; i++) {
      const x = (width / 6) * i + width / 12;
      ctx.beginPath();
      ctx.ellipse(x, soilTop, 40, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  drawSeedsInSoil() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    const soilTop = height * 0.3;
    
    for (let i = 0; i < 6; i++) {
      const x = (width / 6) * i + width / 12;
      const seedImg = this.images[`seed${(i % 3) + 1}`];
      if (seedImg && seedImg.complete) {
        ctx.drawImage(seedImg, x - 10, soilTop - 10, 20, 20);
      }
    }
  }
  
  drawGrowingVegetables() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    const maxVegetables = 36;
    const vegetablesToShow = Math.floor((this.displayPercentage / 100) * maxVegetables);
    
    const rowHeight = (height * 0.6) / 6;
    const soilTop = height * 0.3;
    
    const vegTypes = ['carrot', 'potato', 'tomato', 'carrot', 'potato', 'tomato'];
    let vegCount = 0;
    
    for (let row = 0; row < 6; row++) {
      const y = soilTop + (row * rowHeight) + rowHeight / 2;
      const vegType = vegTypes[row];
      
      for (let col = 0; col < 6; col++) {
        if (vegCount >= vegetablesToShow) break;
        
        const x = (col * (width / 6)) + width / 12;
        const growthProgress = Math.min(1, (vegCount / (vegetablesToShow || 1)) * 1.2);
        
        this.drawVegetableImage(x, y, vegType, growthProgress);
        vegCount++;
      }
    }
  }
  
  drawVegetableImage(x, y, type, growth) {
    const ctx = this.ctx;
    
    if (growth < 0.2) {
      ctx.fillStyle = '#654321';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    
    const imgKey = type;
    const img = this.images[imgKey];
    
    if (img && img.complete && img.naturalWidth > 0) {
      const size = 30 * growth;
      ctx.save();
      ctx.translate(x, y - size * 0.5);
      
      if (type === 'potato') {
      } else if (type === 'tomato') {
        ctx.translate(0, -size * 0.3);
      } else if (type === 'carrot') {
        ctx.translate(0, -size * 0.2);
      }
      
      ctx.drawImage(img, -size/2, -size/2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = type === 'potato' ? '#D2691E' : type === 'tomato' ? '#F44336' : '#FF9800';
      const size = 20 * growth;
      ctx.beginPath();
      ctx.arc(x, y - size/2, size/2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  drawWateringCan(x, y, tilt) {
    const ctx = this.ctx;
    const img = this.images.wateringCan;
    
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt * 0.5);
      ctx.drawImage(img, -30, -30, 60, 60);
      ctx.restore();
    } else {
      const size = 40;
      ctx.save();
      ctx.translate(x, y);
      
      ctx.fillStyle = '#78909C';
      ctx.fillRect(-size * 0.3, -size * 0.2, size * 0.6, size * 0.5);
      
      ctx.fillStyle = '#64B5F6';
      for (let i = 0; i < 3; i++) {
        const dropX = size * 0.3 + i * 5;
        const dropY = size * 0.1 + i * 8;
        ctx.beginPath();
        ctx.arc(dropX, dropY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  
  drawFoodPlated() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    const img = this.images.foodPlate;
    if (img && img.complete && img.naturalWidth > 0) {
      const scale = Math.min(width * 0.8 / img.naturalWidth, height * 0.7 / img.naturalHeight);
      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      const x = (width - drawWidth) / 2;
      const y = (height - drawHeight) / 2 + 20;
      ctx.drawImage(img, x, y, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = '#FAFAFA';
      ctx.beginPath();
      ctx.ellipse(width/2, height/2 + 20, 150, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#D2691E';
      ctx.beginPath();
      ctx.ellipse(width/2 - 40, height/2 + 20, 25, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#F44336';
      ctx.beginPath();
      ctx.arc(width/2 + 30, height/2 + 10, 20, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#FF9800';
      ctx.beginPath();
      ctx.moveTo(width/2 + 60, height/2 + 30);
      ctx.lineTo(width/2 + 80, height/2 + 10);
      ctx.lineTo(width/2 + 70, height/2 + 40);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  drawProgressText() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 4;
    
    const progressText = this.displayPercentage >= 100 
      ? 'Goal Reached!'
      : `${this.displayPercentage.toFixed(1)}% Grown`;
    
    ctx.strokeText(progressText, width / 2, height - 20);
    ctx.fillText(progressText, width / 2, height - 20);
  }
}

let vegPatch;

window.updateVegPatch = function(percent) {
  if (vegPatch) {
    vegPatch.update(vegPatch.total, vegPatch.goal);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  vegPatch = new VegetablePatch('vegPatchCanvas');
  
  if (typeof window.patchInit === 'function') {
    window.patchInit(vegPatch);
  }
});
