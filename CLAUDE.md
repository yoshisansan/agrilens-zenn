# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Testing
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode  
npm run test:coverage      # Run tests with coverage report
```

### Development Server
```bash
npm start                  # Start the Node.js server on port 3000
```

### Dependencies
```bash
npm install                # Install all dependencies
```

## High-Level Architecture

### Project Structure
This is a **Node.js/Express agricultural analysis web application** with Google Earth Engine integration for satellite imagery analysis and AI-powered agricultural insights.

**Core Technology Stack:**
- **Backend**: Node.js/Express server (`server.js`) with Google Earth Engine integration
- **Frontend**: Vanilla JavaScript with Leaflet.js for mapping
- **AI**: Google Cloud Vertex AI (Gemini/Gemma models) with fallback to direct Gemini API
- **Data**: Local storage + CSV export, no database

### Key Directories
- `js/` - Frontend JavaScript modules (main application logic)
- `css/` - Stylesheets (Tailwind CSS-based)
- `templates/` - HTML template functions for dynamic UI
- `test/` - Jest test files
- `shell/` - Deployment scripts for Cloud Run

### Architecture Overview

**Multi-layered modular architecture:**

1. **Entry Point**: `js/main.js` orchestrates initialization of all systems
2. **Configuration Layer**: `js/config.js` provides centralized configuration management
3. **Core Modules**:
   - **Mapping System** (`js/map.js`): Leaflet.js-based interactive field mapping
   - **Analysis Engine** (`js/analysis.js` + `js/vegetation-indices.js`): Google Earth Engine satellite data processing
   - **AI Assistant** (`js/ai-assistant.js` + `js/gemini-api.js`): Dual chat interface with agricultural insights
   - **Data Management** (`js/fields.js`, `js/analysis-storage.js`): Field and analysis data persistence

**Data Flow:**
1. User draws field boundaries on interactive map
2. GeoJSON coordinates sent to server for Google Earth Engine processing
3. Server calculates vegetation indices (NDVI, NDMI, NDRE) from satellite imagery
4. Results displayed with AI-generated agricultural recommendations
5. Data stored locally with export capabilities

### AI System Architecture
- **Dual Provider Support**: Vertex AI (preferred) and direct Gemini API (fallback)
- **Multiple AI Interfaces**: Dashboard chat and standalone chat panel
- **Context-Aware**: Integrates current field data and analysis history
- **Model Selection**: Runtime switching between Gemini/Gemma models

### Configuration Management
The system uses a sophisticated configuration system:
- Server-side environment variables (`.env` file)
- Client-side config loaded from server (`/api/server-info`)
- Dynamic model selection and API provider switching
- Threshold management for vegetation index evaluation

### Module Communication
- **Event-driven architecture**: Custom events for inter-module communication
- **Dependency injection**: `js/modules/module-manager.js` handles service registration
- **Global state**: Minimal global state via `window` objects
- **Error handling**: Centralized error handling with graceful degradation

### Testing Strategy
- **Jest configuration**: `jest.config.js` with Babel transpilation
- **Coverage tracking**: Includes `js/` directory, excludes config and backup files
- **Mock-friendly**: Architecture supports testing with mock data when APIs unavailable

## Environment Configuration

### Required Environment Variables
```bash
# Google Earth Engine (for satellite analysis)
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com

# AI Configuration
AI_API_PROVIDER=vertex                    # or 'gemini-direct'
AI_MODEL=gemini-2.0-flash-thinking-exp-01-21
GOOGLE_CLOUD_REGION=asia-northeast1

# Optional: Direct Gemini API (fallback)
GEMINI_API_KEY=your-api-key
```

### Development Notes
- **Mock Data Mode**: System operates with realistic mock data when Google services unavailable
- **Progressive Enhancement**: Core functionality works without AI/satellite features
- **Bilingual Support**: Primary interface in Japanese with English development documentation
- **Cloud Run Ready**: Configured for Google Cloud Run deployment via `shell/` scripts

### Key Files for Development
- `server.js` - Main server with API endpoints and Google service integration
- `js/main.js` - Frontend application entry point and initialization
- `js/config.js` - Configuration management and runtime settings
- `index.html` - Single-page application entry point
- `jest.config.js` - Test configuration with coverage settings