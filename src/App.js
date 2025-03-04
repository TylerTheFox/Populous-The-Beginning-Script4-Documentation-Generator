import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  Container,
  Typography,
  TextField,
  Box,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ListItem,
  ListItemText,
  Paper,
  Grid,
  List as MUIList,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { debounce } from 'lodash';
import { FixedSizeList as List } from 'react-window';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

const MY_MARKUP = `
# Welcome to the Script4 Documentation
This documentation provides detailed information about Script4's modules, functions, classes, structures, and enums.

## Getting Started

Select a module from the left sidebar to view its contents. Each module contains:

- **Functions** - Callable methods and procedures
- **Enums** - Enumerated types and values  
- **Structures** - Data structures and their members
- **Classes** - Object-oriented classes and methods

## Example Usage

Here's a basic example of using Script4:

\`\`\`lua
import(Module_Game)
import(Module_System)

log("Script Loaded!")
notify_user("Hello World!")

someNum = 1

function OnTurn()
    if EVERY_2POW_TURNS(7) then
        notify_user("10ish seconds has passed! - " .. tostring(someNum))
        log("We got a cool number - " .. tostring(someNum))
        someNum = someNum + 1
    end
end
\`\`\`

Select a module from the left to view its contents.
`;

const HOME_MODULE = {
  module: 'Home',
  description: MY_MARKUP,
  functions: [],
  enums: [],
  structures: [],
  classes: []
};

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredModules, setFilteredModules] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [generationTime, setGenerationTime] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [jsonData, setJsonData] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(300); // 300px default width
  const contentRef = useRef();
  const [navigationStack, setNavigationStack] = useState([]);
  const [currentView, setCurrentView] = useState(null);

  useEffect(() => {
    fetch('./script4_system_spec.json')
      .then(response => response.json())
      .then(data => {
        const modulesWithHome = [HOME_MODULE, ...data.modules];
        setJsonData({ ...data, modules: modulesWithHome });
        setFilteredModules(modulesWithHome);
        setGenerationTime(data.generation_time);
      });
  }, []);

  const filteredData = useMemo(() => {
    if (!jsonData) return [];
    
    const filtered = jsonData.modules
      .filter(module => module.module !== 'Home') // Exclude home from filtering
      .map(module => {
        const filteredFunctions = module.functions.filter(func =>
          func.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const filteredEnums = module.enums.filter(enumItem =>
          enumItem.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const filteredStructures = module.structures.filter(structure =>
          structure.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const filteredClasses = module.classes.filter(cls =>
          cls.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (
          module.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
          filteredFunctions.length > 0 ||
          filteredEnums.length > 0 ||
          filteredStructures.length > 0 ||
          filteredClasses.length > 0
        ) {
          return {
            ...module,
            functions: filteredFunctions,
            enums: filteredEnums,
            structures: filteredStructures,
            classes: filteredClasses
          };
        }
        return null;
      })
      .filter(module => module !== null);

    // Always include home module if no search term, or if search matches 'home'
    if (!searchTerm || 'home'.includes(searchTerm.toLowerCase())) {
      return [HOME_MODULE, ...filtered];
    }
    
    return filtered;
  }, [jsonData, searchTerm]);

  useEffect(() => {
    setFilteredModules(filteredData);
    // Only update expanded if it's not already set and we have data
    if (filteredData.length > 0 && !expanded) {
      setExpanded('Home');
    } else if (filteredData.length === 1) {
      setExpanded(filteredData[0].module);
    }
  }, [filteredData, expanded]);

  const debouncedSearch = useMemo(
    () =>
      debounce((searchValue) => {
        setSearchTerm(searchValue);
      }, 300),
    []
  );

  const handleSearchChange = (event) => {
    debouncedSearch(event.target.value);
  };

  const handleTypeClick = (type) => {
    fetch('./script4_system_spec.json')
      .then(response => response.json())
      .then(data => {
        const foundType = data.modules.flatMap(module => [...module.structures, ...module.classes])
          .find(item => item.name === type);
        setSelectedType(foundType);
      });
  };

  const isKnownType = (type) => {
    if (!type) return { isKnown: false, category: null };
    
    const allModules = filteredModules || [];
    
    // First check structures
    const hasStructure = allModules.some(module => 
      module.structures.some(s => s.name === type)
    );
    if (hasStructure) return { isKnown: true, category: 'structure' };

    // Then check classes
    const hasClass = allModules.some(module => 
      module.classes.some(c => c.name === type)
    );
    if (hasClass) return { isKnown: true, category: 'class' };

    return { isKnown: false, category: null };
  };

  const handleAccordionChange = (module) => (event, isExpanded) => {
    setExpanded(isExpanded ? module : false);
    // Clear navigation stack when selecting a new module
    setNavigationStack([]);
    
  };

  const navigateToSymbol = (symbolType, symbolName, moduleSource) => {
    // Save current state with detailed scroll positions
    const contentPaper = document.querySelector('.content-paper');
    const moduleList = document.querySelector('.sidebar-paper');
    
    setNavigationStack(prev => [...prev, {
      module: expanded,
      contentScroll: contentPaper ? contentPaper.scrollTop : 0,
      listScroll: moduleList ? moduleList.scrollTop : 0,
      symbolId: currentView ? `${currentView.type}-${currentView.name}` : null
    }]);
  
    // Find and navigate to target module
    const targetModule = filteredModules.find(module => {
      switch(symbolType) {
        case 'class':
          return module.classes.some(c => c.name === symbolName);
        case 'structure':
          return module.structures.some(s => s.name === symbolName);
        case 'function':
          return module.functions.some(f => f.name === symbolName);
        case 'enum':
          return module.enums.some(e => e.name === symbolName);
        default:
          return false;
      }
    });
  
    if (targetModule) {
      setExpanded(targetModule.module);
      setCurrentView({ type: symbolType, name: symbolName });
  
      // Use requestAnimationFrame for more reliable scrolling
      requestAnimationFrame(() => {
        const element = document.getElementById(`${symbolType}-${symbolName}`);
        const moduleElement = document.querySelector(`[data-module="${targetModule.module}"]`);
  
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-animation');
          setTimeout(() => element.classList.remove('highlight-animation'), 2000);
        }
  
        if (moduleElement) {
          moduleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  };
  
  const navigateBack = () => {
    if (navigationStack.length > 0) {
      const previous = navigationStack[navigationStack.length - 1];
      setNavigationStack(prev => prev.slice(0, -1));
      setExpanded(previous.module);
      
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        // Restore content scroll position
        const contentPaper = document.querySelector('.content-paper');
        if (contentPaper) {
          contentPaper.scrollTop = previous.contentScroll;
        }
  
        // Restore sidebar scroll position
        const moduleList = document.querySelector('.sidebar-paper');
        if (moduleList) {
          moduleList.scrollTop = previous.listScroll;
        }
  
        // If there was a specific element in view, scroll to it
        if (previous.symbolId) {
          const element = document.getElementById(previous.symbolId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
  
        // Highlight the module in the sidebar
        const moduleElement = document.querySelector(`[data-module="${previous.module}"]`);
        if (moduleElement) {
          moduleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
  
      setCurrentView(previous.symbolId ? {
        type: previous.symbolId.split('-')[0],
        name: previous.symbolId.split('-')[1]
      } : null);
    }
  };

  const ModuleRow = memo(({ index, style, data }) => {
    const module = data[index];
    return (
      <div className="module-row" style={{ ...style }}>
        <Accordion 
          expanded={allExpanded || expanded === module.module} 
          onChange={handleAccordionChange(module.module)}
          className="module-accordion"
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`module-${module.module}-content`}
            id={`module-${module.module}-header`}
            className="accordion-summary"
          >
            <Typography className="accordion-title">{module.module}</Typography>
          </AccordionSummary>
          <AccordionDetails className="accordion-details">
            <ModuleContent module={module} />
          </AccordionDetails>
        </Accordion>
      </div>
    );
  });

  const ClickableSymbol = memo(({ type, name, moduleSource }) => (
    <Box
      component="span"
      onClick={(e) => {
        e.stopPropagation();
        navigateToSymbol(type, name, moduleSource);
      }}
      className="clickable-symbol"
    >
      {name}
    </Box>
  ));

  const ModuleContent = memo(({ module }) => {
    return (
      <Box className="module-content">
        <Typography variant="h5" className="section-title">
          {module.module}
        </Typography>
        
        <Box className="markdown-content">
          <ReactMarkdown
            components={{
              code({node, inline, className, children, ...props}) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={{
                      ...materialLight,
                      'code[class*="language-"]': {
                        color: '#ffffff',
                        background: '#2d2d2d',
                      },
                      'pre[class*="language-"]': {
                        color: '#ffffff',
                        background: '#2d2d2d',
                      }
                    }}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      backgroundColor: '#2d2d2d',
                      color: '#ffffff',
                      padding: '16px',
                      borderRadius: '4px',
                    }}
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}
          >
            {module.description}
          </ReactMarkdown>
        </Box>

        {module.functions.length > 0 && (
          <Box className="section-container">
            <Typography variant="h6" className="section-title">Functions</Typography>
            <Paper className="section-paper">
              {module.functions.map((func, index) => (
                <Box 
                  key={index} 
                  id={`function-${func.name}`}
                  className="function-container"
                >
                  <Typography variant="subtitle2" className="function-title">
                    {`${func.return_type || 'void'} `}
                    <strong>{func.name}</strong>
                    {'('}
                    {func.parameters && Array.isArray(func.parameters) ? 
                      func.parameters
                        .filter(param => param !== 'void' && param !== '')
                        .map((param, pIdx) => {
                          // Handle string format parameters
                          if (typeof param === 'string') {
                            const parts = param.split(' ');
                            const type = parts[0];
                            const name = parts[1] || 'param';
                            return (
                              <React.Fragment key={pIdx}>
                                {pIdx > 0 && ', '}
                                {name}: {isKnownType(type).isKnown ? 
                                  <ClickableSymbol 
                                    type={isKnownType(type).category} 
                                    name={type} 
                                    moduleSource={module.module} 
                                  /> : 
                                  type}
                              </React.Fragment>
                            );
                          }
                          // Handle object format parameters
                          return (
                            <React.Fragment key={pIdx}>
                              {pIdx > 0 && ', '}
                              {param.name}: {isKnownType(param.type).isKnown ? 
                                <ClickableSymbol 
                                  type={isKnownType(param.type).category} 
                                  name={param.type} 
                                  moduleSource={module.module} 
                                /> : 
                                param.type}
                            </React.Fragment>
                          );
                        })
                      : ''}
                    {')'}
                  </Typography>
                  <Typography variant="body2" className="function-text">
                    {func.description}
                  </Typography>
                  {func.return_type && func.return_description && (
                    <Box className="function-returns">
                      <Typography variant="subtitle2">Returns:</Typography>
                      <Typography variant="body2">
                        {func.return_description}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
        )}

        {module.structures.length > 0 && (
          <Box className="section-container">
            <Typography variant="h6" className="section-title">Structures</Typography>
            <Paper className="section-paper">
              {module.structures.map((structure, index) => (
                <Box 
                  key={index} 
                  id={`structure-${structure.name}`}
                  className="function-container"
                >
                  <Typography variant="subtitle2" className="function-title">
                    {structure.name}
                  </Typography>
                  <Typography variant="body2" className="function-text">
                    {structure.description}
                  </Typography>
                  {structure.members && structure.members.length > 0 && (
                    <Box className="structure-members">
                      <Typography variant="subtitle2">Members:</Typography>
                      {structure.members.map((member, idx) => {
                        // Extract type and name from either string or object format
                        const memberType = typeof member === 'string' 
                          ? member.split(' ').slice(0, -1).join(' ') 
                          : (member.datatype || 'unknown');
                        const memberName = typeof member === 'string'
                          ? member.split(' ').pop()
                          : member.name;

                        const typeResult = isKnownType(memberType);

                        return (
                          <Typography key={idx} variant="body2">
                            • {memberName}: {typeResult.isKnown ? (
                              <ClickableSymbol 
                                type={typeResult.category} 
                                name={memberType} 
                                moduleSource={module.module}
                              />
                            ) : (
                              memberType
                            )}
                          </Typography>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
        )}

        {module.classes.length > 0 && (
          <Box className="section-container">
            <Typography variant="h6" className="section-title">Classes</Typography>
            <Paper className="section-paper">
              {module.classes.map((cls, index) => (
                <Box 
                  key={index} 
                  id={`class-${cls.name}`}
                  className="function-container"
                >
                  <Typography variant="subtitle2" className="function-title">
                    {`class ${cls.name}`}
                    {cls.base_class && (
                      <>
                        {' : '}
                        {isKnownType(cls.base_class).isKnown ? (
                          <ClickableSymbol 
                            type={isKnownType(cls.base_class).category} 
                            name={cls.base_class} 
                            moduleSource={module.module}
                          />
                        ) : cls.base_class}
                      </>
                    )}
                  </Typography>
                  <Typography variant="body2" className="function-text">
                    {cls.description}
                  </Typography>
                  
                  {/* Class Functions */}
                  {cls.functions && cls.functions.length > 0 && (
                    <Box className="class-functions">
                      <Typography variant="subtitle2">Functions:</Typography>
                      {cls.functions.map((func, idx) => (
                        <Box key={idx} className="class-function-item">
                          <Typography variant="body2" className="class-function-name">
                            {/* Make return type clickable if it's a known type */}
                            {isKnownType(func.return).isKnown ? (
                              <ClickableSymbol 
                                type={isKnownType(func.return).category}
                                name={func.return}
                                moduleSource={module.module}
                              />
                            ) : (
                              `${func.return || 'void'}`
                            )}{' '}
                            <strong>{func.name}</strong>
                            {'('}
                            {func.parameters && Array.isArray(func.parameters)
                              ? func.parameters
                                  .filter(param => param !== 'void' && param !== '')
                                  .map((param, pIdx) => {
                                    // Handle string parameter format
                                    if (typeof param === 'string') {
                                      const parts = param.split(' ');
                                      const type = parts[0];
                                      const name = parts.length > 1 ? parts[1] : 'param';
                                      
                                      return (
                                        <React.Fragment key={pIdx}>
                                          {pIdx > 0 && ', '}
                                          {name}: {isKnownType(type).isKnown ? (
                                            <ClickableSymbol 
                                              type={isKnownType(type).category}
                                              name={type}
                                              moduleSource={module.module}
                                            />
                                          ) : type}
                                        </React.Fragment>
                                      );
                                    }
                                    // Handle object parameter format
                                    return (
                                      <React.Fragment key={pIdx}>
                                        {pIdx > 0 && ', '}
                                        {param.name}: {isKnownType(param.type).isKnown ? (
                                          <ClickableSymbol 
                                            type={isKnownType(param.type).category}
                                            name={param.type}
                                            moduleSource={module.module}
                                          />
                                        ) : param.type}
                                      </React.Fragment>
                                    );
                                  })
                              : ''}
                            {')'}
                          </Typography>
                          <Typography variant="body2" className="class-function-description">
                            {func.description}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
        )}

        {module.enums.length > 0 && (
          <Box className="section-container">
            <Typography variant="h6" className="section-title">Enums</Typography>
            <Paper className="section-paper">
              {module.enums.map((enumItem, index) => (
                <Box 
                  key={index} 
                  id={`enum-${enumItem.name}`}
                  className="function-container"
                >
                  <Typography variant="subtitle2" className="function-title">
                    {enumItem.name}
                  </Typography>
                  <Typography variant="body2" className="function-text">
                    {enumItem.description}
                  </Typography>
                  {enumItem.values && enumItem.values.length > 0 && (
                    <Box className="structure-members">
                      <Typography variant="subtitle2">Values:</Typography>
                      {enumItem.values.map((value, idx) => (
                        <Typography key={idx} variant="body2">
                          • {value.name} = {value.value} - {value.description || ''}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
        )}
      </Box>
    );
  });

  

  return (
    <Container maxWidth="xl" className="app-container">
      <Box className="app-wrapper">
        <Box className="header-container">
          <Box className="title-container">
            <img src="./logo.png" alt="Script4 Logo" className="logo" />
            <Box>
              <Typography variant="h4" className="main-title">
                Script4 Documentation
              </Typography>
              <Typography variant="body2" className="generation-time">
                Generated on: {generationTime}
              </Typography>
            </Box>
          </Box>
          {navigationStack.length > 0 && (
            <Button
              variant="outlined"
              onClick={navigateBack}
              startIcon={<ArrowBackIcon />}
              className="back-button"
            >
              Back
            </Button>
          )}
        </Box>

        <TextField
          label="Search"
          variant="outlined"
          fullWidth
          size="medium"
          onChange={handleSearchChange}
          className="search-field"
        />

        <Grid container spacing={3} className="content-grid">
          <Resizable
            width={sidebarWidth}
            height={window.innerHeight - 250}
            onResize={(e, { size }) => {
              setSidebarWidth(size.width);
            }}
            handle={<div className="resizer-handle" />}
          >
            <Grid item className="sidebar-grid-item" style={{ width: sidebarWidth }}>
              <Paper className="sidebar-paper">
                <MUIList>
                  {filteredModules.map((module) => (
                    <ListItem 
                      key={module.module}
                      data-module={module.module}
                      className={`module-list-item ${expanded === module.module ? 'selected' : ''}`}
                      onClick={() => {
                        setExpanded(module.module);
                        setNavigationStack([]);
                      }}
                    >
                      <ListItemText 
                        primary={module.module}
                        secondary={module.module === 'Home' ? null : 
                          `F:${module.functions.length} | S:${module.structures.length} | C:${module.classes.length} | E:${module.enums.length}`}
                      />
                    </ListItem>
                  ))}
                </MUIList>
              </Paper>
              {/* Add the PDF link below the Paper component */}
              <Box mt={2} sx={{ textAlign: 'center' }}>
                <Link 
                  href="./script4_documentation.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  className="pdf-download-link"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px',
                    color: 'primary.main',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  📄 Download PDF Documentation
                </Link>
              </Box>
            </Grid>
          </Resizable>

          <Grid item xs className="content-grid-item">
            <Paper className="content-paper">
              {expanded ? (
                <Box className="module-content">
                  {filteredModules
                    .filter(module => module.module === expanded)
                    .map(module => (
                      <ModuleContent key={module.module} module={module} />
                    ))}
                </Box>
              ) : (
                <Typography variant="body1" color="textSecondary" className="empty-state">
                  Select a module from the left to view its contents
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default App;