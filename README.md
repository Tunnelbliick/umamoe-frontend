# Uma.moe Frontend

A comprehensive Umamusume: Pretty Derby database and resource hub built with Angular. Explore character data, inheritance records, support cards, tierlists, and detailed statistics for the popular mobile game.

![Uma.moe](https://img.shields.io/badge/uma.moe-live-success)
![Angular](https://img.shields.io/badge/Angular-17-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🏇 Features

### 📊 **Statistics & Analytics**
- Comprehensive character usage statistics across different race distances
- Team composition analysis and meta trends
- Support card popularity and effectiveness tracking
- Real-time data visualization with interactive charts

### 🧬 **Inheritance Database**
- Extensive inheritance record database with search and filtering
- Factor tracking (blue, pink, green, white sparks)
- Parent lineage visualization
- Support card integration data

### 🃏 **Support Cards**
- Complete support card database with detailed stats
- Card effectiveness analysis and recommendations
- Banner tracking and gacha information
- Limit break and experience data

### 📈 **Tierlists & Rankings**
- Data-driven character tierlists
- Performance analysis across race distances
- Meta evolution tracking
- Precomputed rankings for optimal performance

### 🎯 **Advanced Features**
- Multi-distance race analysis
- Character-specific performance metrics
- Team class distribution insights
- Interactive data exploration tools

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Angular CLI (v17+)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Tunnelbliick/umamoe-frontend.git
   cd umamoe-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:4200`

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Build for production (includes precomputation) |
| `npm run build:dev` | Build for development |
| `npm run build:prod` | Production build with optimizations |
| `npm run precompute` | Run tierlist precomputation |
| `npm run watch` | Build and watch for changes |
| `npm test` | Run unit tests |
| `npm run lint` | Lint the codebase |

## 🏗️ Project Structure

```
src/
├── app/
│   ├── components/           # Reusable UI components
│   │   ├── statistics-chart/
│   │   ├── class-filter/
│   │   ├── card-details-dialog/
│   │   └── ...
│   ├── pages/               # Route components
│   │   ├── statistics/
│   │   ├── inheritance-database/
│   │   └── ...
│   ├── services/            # Angular services
│   │   ├── statistics.service.ts
│   │   ├── inheritance.service.ts
│   │   └── ...
│   ├── models/              # TypeScript interfaces
│   └── data/                # Static data files
├── assets/                  # Static assets
│   ├── images/
│   └── data/
└── environments/            # Environment configs
```

## 📱 Key Components

### Statistics Dashboard
Real-time analytics dashboard showing:
- Character usage trends
- Distance-specific performance data
- Support card meta analysis
- Team composition insights

### Inheritance Database
Comprehensive breeding record system featuring:
- Advanced search and filtering
- Factor visualization
- Performance tracking
- Community submissions

### Support Card Library
Complete card database with:
- Detailed card information
- Effectiveness ratings
- Banner history
- Optimization recommendations

## 🔧 Configuration

### Environment Setup
Configure your environment variables in:
- `src/environments/environment.ts` (development)
- `src/environments/environment.prod.ts` (production)

### Proxy Configuration
API proxy settings are configured in `proxy.conf.json` for development.

## 📊 Data Processing

The application includes several data processing scripts:

- **`scripts/statistic.py`** - Generates statistical datasets
- **`scripts/precompute-tierlist.js`** - Precomputes tierlist data
- **`scripts/db-convert.py`** - Database conversion utilities
- **`scripts/factor-convert.py`** - Factor data processing

## 🎨 Styling

The project uses Angular Material with custom SCSS:
- `src/styles.scss` - Global styles
- `src/styles/utilities.scss` - Utility classes
- Component-specific SCSS files

## 🚀 Production Build

For production deployment:

```bash
npm run build:prod
```

This will:
1. Run tierlist precomputation
2. Build the application with production optimizations
3. Generate optimized assets in the `dist/` folder

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📈 Performance

The application is optimized for performance with:
- Lazy loading of route modules
- OnPush change detection strategy
- Precomputed data for faster loading
- Efficient data caching
- Image optimization

## 🔗 Related Projects

- **Backend API** - Powers the inheritance database and statistics
- **Data Processing Pipeline** - Handles game data extraction and analysis
- **Mobile App** - Companion mobile application

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Live Demo

Visit [uma.moe](https://uma.moe) to see the application in action!

## 🙏 Acknowledgments

- Cygames for creating Umamusume: Pretty Derby
- The Umamusume community for data contributions
- Contributors and maintainers of this project

---

*Built with ❤️ for the Umamusume community*