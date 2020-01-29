import uuidv4 from 'uuid/v4';
import Octokit from '@octokit/rest';
import { STATUS_CODES } from 'http';
import Snippet, { sourceType } from '../models/Snippet';
import { sortById } from '../utils/utils';
import { setLoading, setError } from './ui';
import { snippets } from '../db/snippets';

const namespace = name => `SNIPPETS_${name}`;

export const ADD_SNIPPET = namespace('ADD_SNIPPET');
export const UPDATE_SNIPPET = namespace('UPDATE_SNIPPET');
export const DELETE_SNIPPET = namespace('DELETE_SNIPPET');
export const SET_CURRENT_SNIPPET = namespace('SET_CURRENT_SNIPPET');
export const LOAD_SNIPPETS = namespace('LOAD_SNIPPETS');
export const SET_SEARCH_SNIPPETS = namespace('SET_SEARCH_SNIPPETS');

export const SYNCHRONIZE_TYPE = {
  BACKUP: 'BACKUP',
  IMPORT: 'IMPORT'
};

const loadSnippetsAction = (list, current, lastId) => ({
  type: LOAD_SNIPPETS,
  list,
  current,
  lastId
});

const addSnippetAction = (snippet, list) => ({
  type: ADD_SNIPPET,
  snippet,
  list
});

const updateSnippetAction = (snippet, list) => ({
  type: UPDATE_SNIPPET,
  snippet,
  list
});

const deleteSnippetAction = (current, list) => ({
  type: DELETE_SNIPPET,
  current,
  list
});

const setSearchSnippetsAction = (query) => ({
  type: SET_SEARCH_SNIPPETS,
  query
});

export const setCurrentSnippet = (id) => ({
  type: SET_CURRENT_SNIPPET,
  id
});

export const initSnippets = () => {
  return (dispatch) => {
    return new Promise((resolve) => {
      snippets.findAll(data => {
        const snippets = data.sort(sortById).map(entry => new Snippet(entry));
        const lastId = Math.max.apply(Math, snippets.map(entry => entry.id)) | 0;

        dispatch(loadSnippetsAction(snippets, snippets[0], lastId));
        resolve();
      });
    })
  };
};

export const addSnippet = () => {
  return (dispatch, getState) => {
    const { snippets: { lastId, list } } = getState();

    const newSnippet = new Snippet({
      id: lastId + 1,
      source: sourceType.LOCAL,
      uuid: uuidv4(),
      title: 'New',
      language: 'text',
      content: '',
      lastUpdated: new Date()
    });
    const updatedList = [...list, newSnippet].sort(sortById);

    snippets.add(newSnippet);
    dispatch(addSnippetAction(newSnippet, updatedList));
  };
};

export const updateSnippet = (snippet) => {
  return (dispatch, getState) => {
    const { snippets: { current, list } } = getState();

    const toUpdateIndex = list.findIndex(element => element.id === current.id);
    const updatedSnippet = new Snippet({ ...snippet, lastUpdated: new Date() });
    const updatedList = [...list];
    updatedList[toUpdateIndex] = updatedSnippet;

    snippets.update(updatedSnippet);
    dispatch(updateSnippetAction(updatedSnippet, updatedList));
  };
};

export const deleteSnippet = () => {
  return (dispatch, getState) => {
    const { snippets: { current, list } } = getState();

    const updatedList = list.filter(element => element.id !== current.id);

    snippets.remove(current.id);
    dispatch(deleteSnippetAction(updatedList[0], updatedList));
  };
};

export const setSearchSnippets = (query) => {
  return (dispatch) => {
    dispatch(setSearchSnippetsAction(query));
  };
};

const backupSnippets = (authToken, gistId, snippets) => {
  return new Promise((resolve, reject) => {
    const octokit = new Octokit({ auth: authToken });

    const fileName = (new Date()).toISOString();
    const request = {
      gist_id: gistId,
      files: {
        [fileName]: {
          content: JSON.stringify(snippets)
        }
      }
    };

    octokit.gists.update(
      request
    ).then(response => {
      resolve(response);
    }).catch(error => {
      reject(error);
    });
  });
};

const importGist = (authToken, gistId) => {
  return new Promise((resolve, reject) => {
    const octokit = new Octokit({ auth: authToken });

    octokit.gists.get({
      gist_id: gistId
    }).then(response => {
      resolve(response);
    }).catch(error => {
      reject(error);
    });
  });
};

export const synchronizeGist = (action, gistId) => {
  return (dispatch, getState, ipcRenderer) => {
    const { auth: { token }, snippets: { list } } = getState();

    return new Promise((resolve, reject) => {
      dispatch(setLoading(true));

      if (action === SYNCHRONIZE_TYPE.BACKUP) {
        backupSnippets(
          token, gistId, list
        ).then(response => {
          console.log(response);
          ipcRenderer.send('SET_GH_AUTH_DATA', { token, backupGistId: gistId });
          snippets.updateAll({ source: sourceType.GIST });
          dispatch(initSnippets());
          dispatch(setLoading(false));
          resolve();
        }).catch(error => {
          console.error(error);
          dispatch(setLoading(false));
          reject();
        });
      } else if (action === SYNCHRONIZE_TYPE.IMPORT) {
        importGist(
          token, gistId
        ).then(response => {
          console.log(response);
          resolve();
        }).catch(error => {
          console.error(error);
          dispatch(setLoading(false));
          reject();
        });
      }
    });
  };
};

export const createBackupGist = (description) => {
  return (dispatch, getState, ipcRenderer) => {
    const { auth: { token }, snippets: { list } } = getState();

    return new Promise((resolve, reject) => {
      dispatch(setLoading(true));

      const octokit = new Octokit({ auth: token });

      const fileName = (new Date()).toISOString();
      const request = {
        description: description,
        public: false,
        files: {
          [fileName]: {
            content: JSON.stringify(list)
          }
        }
      };

      octokit.gists.create(
        request
      ).then(response => {
        console.log(response);
        const gistId = response.data.id;
        ipcRenderer.send('SET_GH_AUTH_DATA', { token, backupGistId: gistId });
        snippets.updateAll({ source: sourceType.GIST });
        dispatch(initSnippets());
        dispatch(setLoading(false));
        resolve();
      }).catch(error => {
        console.error(error);
        dispatch(setError(STATUS_CODES[error.status]));
        dispatch(setLoading(false));
        reject();
      });
    });
  };
};
