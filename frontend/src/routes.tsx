import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import Intake from './pages/Intake'
import NotBuilt from './pages/NotBuilt'
import ReviewQueue from './pages/ReviewQueue'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <NotBuilt name="Needs" /> },
      { path: 'intake', element: <Intake /> },
      { path: 'review', element: <ReviewQueue /> },
      { path: 'matching', element: <NotBuilt name="Matching" /> },
      { path: 'stock', element: <NotBuilt name="Stock & Depots" /> },
    ],
  },
  { path: '/public', element: <NotBuilt name="Report a need" /> },
])
