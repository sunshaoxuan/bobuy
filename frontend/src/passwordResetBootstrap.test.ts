import {capturePasswordResetToken} from './passwordResetBootstrap';

afterEach(()=>history.replaceState(null,'','/'));

it.each(['/reset-password/','/Reset-Password','/ADMIN/RESET-PASSWORD/'])(
 'captures and scrubs a token for the router-compatible path %s',
 path=>{
  history.replaceState(null,'',`${path}#token=synthetic-bootstrap-token`);
  expect(capturePasswordResetToken()).toBe('synthetic-bootstrap-token');
  expect(location.pathname).toBe(path);
  expect(location.hash).toBe('');
 }
);

it('does not consume a fragment on an unrelated route',()=>{
 history.replaceState(null,'','/account#token=synthetic-unrelated-token');
 expect(capturePasswordResetToken()).toBe('');
 expect(location.hash).toBe('#token=synthetic-unrelated-token');
});
