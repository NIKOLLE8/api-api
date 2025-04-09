// index.js - API para extraer datos del MEF
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS para que Excel pueda acceder
app.use(cors());
app.use(express.json());

// Ruta raíz
app.get('/', (req, res) => {
  res.send({
    status: 'ok',
    message: 'API para extraer datos de proyectos del MEF',
    endpoints: {
      '/api/project/:cui': 'Obtiene datos de un proyecto específico por CUI',
      '/api/projects': 'Obtiene datos de múltiples proyectos (POST con array de CUIs)'
    }
  });
});

// Ruta para obtener datos de un solo proyecto
app.get('/api/project/:cui', async (req, res) => {
  try {
    const cui = req.params.cui;
    const data = await fetchProjectData(cui);
    res.json(data);
  } catch (error) {
    console.error(`Error al obtener datos del CUI ${req.params.cui}:`, error);
    res.status(500).json({
      error: 'Error al obtener datos del proyecto',
      message: error.message,
      cui: req.params.cui
    });
  }
});

// Ruta para obtener datos de múltiples proyectos
app.post('/api/projects', async (req, res) => {
  try {
    if (!req.body.cuis || !Array.isArray(req.body.cuis)) {
      return res.status(400).json({ error: 'Se requiere un array de CUIs' });
    }

    const cuis = req.body.cuis;
    const results = [];
    const errors = [];

    // Procesar los CUIs en secuencia para evitar bloqueos
    for (const cui of cuis) {
      try {
        const data = await fetchProjectData(cui);
        results.push(data);
      } catch (error) {
        console.error(`Error al obtener datos del CUI ${cui}:`, error);
        errors.push({
          cui,
          error: error.message
        });
      }
    }

    res.json({
      results,
      errors,
      total: cuis.length,
      successful: results.length,
      failed: errors.length
    });
  } catch (error) {
    console.error('Error en el procesamiento de proyectos:', error);
    res.status(500).json({
      error: 'Error en el procesamiento de proyectos',
      message: error.message
    });
  }
});

// Función para extraer datos de un proyecto del MEF
async function fetchProjectData(cui) {
  // URL base del MEF
  const url = `https://ofi5.mef.gob.pe/ssi/Ssi/Index?codigo=${cui}&tipo=2`;
  
  try {
    // Obtener la página principal
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    // Cargar la respuesta HTML en Cheerio
    const $ = cheerio.load(response.data);
    
    // Extraer el nombre del proyecto
    const projectName = $('#td_nominv').text().trim();
    
    // Verificar si el proyecto existe
    if (!projectName) {
      throw new Error(`No se encontró proyecto con CUI ${cui}`);
    }
    
    // Obtener datos financieros
    // Primero necesitamos simular el clic en la pestaña de finanzas
    // En un entorno real, necesitaríamos hacer una segunda petición a la URL que carga los datos financieros
    
    // Intentar extraer datos directamente
    let data = {
      cui: cui,
      nombre: projectName,
      pim: 0,
      certificacion: 0,
      compromiso_anual: 0,
      devengado: 0,
      porcentaje_cert: 0,
      porcentaje_comp: 0,
      porcentaje_dev: 0
    };
    
    // Extraer datos financieros si están disponibles en la página inicial
    // En un entorno real, podríamos necesitar una segunda petición
    // Simulamos la extracción para este ejemplo
    if ($('#tb_hist_anual').length > 0) {
      const currentYear = new Date().getFullYear().toString();
      
      $('#tb_hist_anual .fil_hisfinan').each((i, row) => {
        const cells = $(row).find('td');
        const year = $(cells[0]).text().trim();
        
        if (year === currentYear) {
          // Extraer y limpiar valores numéricos
          const pim = parseFloat($(cells[2]).text().trim().replace(/,/g, '').replace(/\s/g, '') || '0');
          const certificacion = parseFloat($(cells[3]).text().trim().replace(/,/g, '').replace(/\s/g, '') || '0');
          const compromiso_anual = parseFloat($(cells[4]).text().trim().replace(/,/g, '').replace(/\s/g, '') || '0');
          const devengado = parseFloat($(cells[5]).text().trim().replace(/,/g, '').replace(/\s/g, '') || '0');
          
          // Calcular porcentajes
          const porcentaje_cert = pim > 0 ? (certificacion / pim) * 100 : 0;
          const porcentaje_comp = pim > 0 ? (compromiso_anual / pim) * 100 : 0;
          const porcentaje_dev = pim > 0 ? (devengado / pim) * 100 : 0;
          
          // Actualizar datos
          data = {
            cui,
            nombre: projectName,
            pim,
            certificacion,
            compromiso_anual,
            devengado,
            porcentaje_cert,
            porcentaje_comp,
            porcentaje_dev
          };
        }
      });
    } else {
      // En un entorno real, aquí haríamos una segunda petición a la URL que carga los datos financieros
      console.log(`Datos financieros no disponibles directamente para CUI ${cui}, se requiere una segunda petición`);
      
      // Extraer el token necesario para hacer la segunda petición si es necesario
      // const token = $('input[name="__RequestVerificationToken"]').val();
      
      // Implementar la segunda petición para obtener los datos financieros
      // Esta es una simplificación, ya que necesitaríamos analizar cómo funciona la web del MEF
    }
    
    return data;
  } catch (error) {
    console.error(`Error al extraer datos del CUI ${cui}:`, error);
    throw new Error(`Error al extraer datos: ${error.message}`);
  }
}

// Iniciar el servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API ejecutándose en el puerto ${PORT}`);
  });
}

module.exports = app; // Para despliegue en Vercel