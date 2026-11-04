import logo from '../assets/jackpotmc-logo.png';
import {ShieldCheck} from 'lucide-react';
export default function Login(){return <div className="login"><div className="loginCard"><img className="login-logo" src={logo} alt="JackpotMC"/><h1>JackpotMC Staff</h1><p>Restricted administration panel for authorized JackpotMC staff.</p><a className="discord" href="/auth/login">Continue with Discord</a><div className="notice"><ShieldCheck size={16}/> Discord login, staff allowlist and account linking are required.</div></div></div>}
