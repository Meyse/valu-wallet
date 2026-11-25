// Same deeplink hand-off as the old root stacks (SignedOutStackScreens and friends): a parsed
// deeplink opens the DeepLink route on the root stack.
import {useEffect} from 'react';
import {useDispatch, useSelector, useStore} from 'react-redux';
import {setDeeplinkUrl} from '../../actions/actionCreators';

export function useDeeplinkForward(navigation) {
  const deeplinkId = useSelector(state => state.deeplink.id);
  const deeplinkUrl = useSelector(state => state.deeplink.url);
  const parsingUrl = useSelector(state => state.deeplink.parsingUrl);
  const requestId = useSelector(state => state.deeplink.requestId);
  const store = useStore();
  const dispatch = useDispatch();

  useEffect(() => {
    const current = store.getState().deeplink;
    if (
      navigation &&
      deeplinkId != null &&
      deeplinkUrl != null &&
      !parsingUrl &&
      current.requestId === requestId &&
      current.url === deeplinkUrl &&
      !current.parsingUrl
    ) {
      dispatch(setDeeplinkUrl(null));
      navigation.navigate('DeepLink', {screen: 'VerifyDeepLink', pop: true}, {pop: true});
    }
  }, [deeplinkId, deeplinkUrl, parsingUrl, requestId, store, dispatch, navigation]);
}
