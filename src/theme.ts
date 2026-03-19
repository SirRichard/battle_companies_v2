import { createTheme } from '@mui/material/styles'

/**
 * Battle Companies Theme
 *
 * Aesthetic: aged parchment, tooled leather, wrought iron, gilded script.
 * MUI used for structure only — all visual tokens overridden here.
 *
 * Fonts loaded via index.html:
 *   - Cinzel Decorative  (display / headings)
 *   - IM Fell English    (body / readable serif)
 */

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#C9A84C', // aged gold
      light: '#E8CC7A',
      dark: '#8B6914',
      contrastText: '#1A0F05',
    },
    secondary: {
      main: '#8B3A2A', // deep burgundy / dried blood
      light: '#B05040',
      dark: '#5C1E10',
      contrastText: '#F5EDD8',
    },
    background: {
      default: '#1A0F05', // darkest parchment / hearth-dark
      paper: '#2A1A0A', // dark leather
    },
    text: {
      primary: '#F5EDD8', // warm parchment
      secondary: '#C4A97A', // aged ink
      disabled: '#6B5840',
    },
    divider: '#4A3520',
    error: {
      main: '#C0392B',
      light: '#E74C3C',
    },
    success: {
      main: '#4A7C59',
      light: '#6BAE7A',
    },
    warning: {
      main: '#C9A84C',
    },
  },

  typography: {
    fontFamily: '"IM Fell English", Georgia, serif',
    h1: {
      fontFamily: '"Cinzel Decorative", serif',
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '0.05em',
      color: '#C9A84C',
    },
    h2: {
      fontFamily: '"Cinzel Decorative", serif',
      fontSize: '1.5rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      color: '#C9A84C',
    },
    h3: {
      fontFamily: '"Cinzel Decorative", serif',
      fontSize: '1.2rem',
      fontWeight: 400,
      letterSpacing: '0.03em',
      color: '#E8CC7A',
    },
    h4: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: '1.1rem',
      fontWeight: 700,
      fontStyle: 'italic',
      color: '#E8CC7A',
    },
    h5: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: '1rem',
      fontWeight: 700,
    },
    h6: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: '0.9rem',
      fontWeight: 700,
    },
    body1: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: '1rem',
      lineHeight: 1.7,
    },
    body2: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    caption: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: '0.75rem',
      fontStyle: 'italic',
      color: '#C4A97A',
    },
    button: {
      fontFamily: '"Cinzel Decorative", serif',
      fontSize: '0.75rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },

  shape: {
    borderRadius: 2,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: `
            radial-gradient(ellipse at 20% 20%, rgba(139,105,20,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 80%, rgba(139,58,42,0.06) 0%, transparent 60%)
          `,
          minHeight: '100vh',
        },
        '*::-webkit-scrollbar': {
          width: '6px',
        },
        '*::-webkit-scrollbar-track': {
          background: '#1A0F05',
        },
        '*::-webkit-scrollbar-thumb': {
          background: '#4A3520',
          borderRadius: '3px',
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          padding: '10px 20px',
          minHeight: 44,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
            pointerEvents: 'none',
          },
        },
        contained: {
          background: 'linear-gradient(180deg, #D4A84C 0%, #8B6914 100%)',
          border: '1px solid #C9A84C',
          boxShadow:
            '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          color: '#1A0F05',
          '&:hover': {
            background: 'linear-gradient(180deg, #E8CC7A 0%, #A07820 100%)',
            boxShadow:
              '0 4px 16px rgba(201,168,76,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
          },
        },
        outlined: {
          borderColor: '#C9A84C',
          color: '#C9A84C',
          '&:hover': {
            borderColor: '#E8CC7A',
            background: 'rgba(201,168,76,0.08)',
          },
        },
        text: {
          color: '#C9A84C',
          '&:hover': {
            background: 'rgba(201,168,76,0.08)',
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(160deg, #2E1E0A 0%, #221508 100%)',
          border: '1px solid #4A3520',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background:
              'linear-gradient(90deg, transparent, #C9A84C40, transparent)',
          },
          position: 'relative',
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            fontFamily: '"IM Fell English", Georgia, serif',
            '& fieldset': {
              borderColor: '#4A3520',
            },
            '&:hover fieldset': {
              borderColor: '#8B6914',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#C9A84C',
            },
          },
          '& .MuiInputLabel-root': {
            fontFamily: '"IM Fell English", Georgia, serif',
            color: '#C4A97A',
            '&.Mui-focused': {
              color: '#C9A84C',
            },
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontStyle: 'italic',
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#4A3520',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(160deg, #2E1E0A 0%, #1A0F05 100%)',
          border: '1px solid #4A3520',
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: '#3A2510',
          borderRadius: 2,
        },
        bar: {
          background: 'linear-gradient(90deg, #8B6914, #C9A84C)',
          borderRadius: 2,
        },
      },
    },

    MuiStepper: {
      styleOverrides: {
        root: {
          background: 'transparent',
          padding: 0,
        },
      },
    },

    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontFamily: '"IM Fell English", Georgia, serif',
          color: '#6B5840',
          '&.Mui-active': {
            color: '#C9A84C',
          },
          '&.Mui-completed': {
            color: '#8B6914',
          },
        },
      },
    },

    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: '#3A2510',
          '&.Mui-active': {
            color: '#C9A84C',
          },
          '&.Mui-completed': {
            color: '#8B6914',
          },
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          fontFamily: '"IM Fell English", Georgia, serif',
          border: '1px solid currentColor',
        },
      },
    },

    MuiSnackbar: {
      defaultProps: {
        anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      },
    },
  },
})
