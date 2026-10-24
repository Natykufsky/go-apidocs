// Lazy Swagger UI chunk: loads the component AND its stylesheet together so
// the heavy swagger-ui bundle + CSS only arrive when the sandbox is opened.
// The theme overrides are imported last so they win the cascade over
// swagger-ui.css (both ship in this same chunk, preserving import order).
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import './swagger-ui-overrides.css';

export default SwaggerUI;
